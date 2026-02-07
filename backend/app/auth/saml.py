"""SAML 2.0 authentication implementation using pysaml2."""
import base64
from typing import Optional, Dict, Any
from urllib.parse import urlencode
from datetime import datetime

from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.logging import logger
from app.models import User, UserRole
from app.auth.security import create_access_token, create_refresh_token
from app.audit.manager import AuditManager

router = APIRouter(prefix="/auth/saml", tags=["saml"])


def get_saml_settings() -> Dict[str, Any]:
    """Build SAML configuration from environment settings."""
    if not settings.SAML_ENABLED:
        raise ValueError("SAML is not enabled")
    
    if not settings.SAML_METADATA_URL and not settings.SAML_ENTITY_ID:
        raise ValueError("SAML configuration is incomplete")
    
    # Service Provider (our app) settings
    sp_settings = {
        "entityid": settings.SAML_ENTITY_ID or f"{settings.CORS_ORIGINS.split(',')[0]}/auth/saml/metadata",
        "assertion_consumer_service": [
            {
                "url": settings.SAML_ACS_URL or f"{settings.CORS_ORIGINS.split(',')[0]}/auth/saml/acs",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            }
        ],
        "single_logout_service": [
            {
                "url": f"{settings.CORS_ORIGINS.split(',')[0]}/auth/saml/slo",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            }
        ],
        "allow_unsolicited": True,
        "authn_requests_signed": False,
        "logout_requests_signed": False,
        "want_assertions_signed": True,
        "want_response_signed": False,
    }
    
    return {
        "entityid": sp_settings["entityid"],
        "service": {
            "sp": sp_settings
        },
        "metadata": {
            "remote": [
                {"url": settings.SAML_METADATA_URL}
            ] if settings.SAML_METADATA_URL else []
        },
        "debug": settings.DEBUG,
        "allow_unknown_attributes": True,
    }


def map_saml_role(saml_attributes: Dict) -> UserRole:
    """Map SAML attributes to application role.
    
    Common attribute names for roles:
    - groups, memberOf, role, roles, userRole
    """
    role_attributes = saml_attributes.get("groups", []) or \
                     saml_attributes.get("memberOf", []) or \
                     saml_attributes.get("role", []) or \
                     saml_attributes.get("roles", [])
    
    if not role_attributes:
        return UserRole.VIEWER
    
    # Normalize to list
    if isinstance(role_attributes, str):
        role_attributes = [role_attributes]
    
    # Map to application roles (case-insensitive)
    role_str = role_attributes[0].lower() if role_attributes else ""
    
    if "admin" in role_str:
        return UserRole.ADMIN
    elif "threat_intel" in role_str or "ti" in role_str or "analyst" in role_str:
        return UserRole.TI
    elif "threat_hunt" in role_str or "th" in role_str or "hunter" in role_str:
        return UserRole.TH
    elif "incident" in role_str or "ir" in role_str or "responder" in role_str:
        return UserRole.IR
    else:
        return UserRole.VIEWER


def provision_saml_user(
    db: Session, 
    nameid: str, 
    attributes: Dict,
    email: str = None,
    name: str = None
) -> User:
    """Create or update a user from SAML assertion.
    
    Args:
        db: Database session
        nameid: SAML NameID (unique identifier)
        attributes: SAML attributes from assertion
        email: Email from SAML assertion
        name: Full name from SAML assertion
    
    Returns:
        User object (created or updated)
    """
    # Try to find existing user by SAML nameid or email
    user = db.query(User).filter(User.saml_nameid == nameid).first()
    
    if not user and email:
        user = db.query(User).filter(User.email == email).first()
    
    # Extract attributes
    extracted_email = email or \
                     attributes.get("email", [None])[0] or \
                     attributes.get("mail", [None])[0] or \
                     attributes.get("emailAddress", [None])[0]
    
    extracted_name = name or \
                    attributes.get("displayName", [None])[0] or \
                    attributes.get("cn", [None])[0] or \
                    attributes.get("givenName", [""])[0] + " " + attributes.get("sn", [""])[0]
    
    # Generate username from email or nameid
    username = extracted_email.split("@")[0] if extracted_email else nameid[:50]
    
    if user:
        # Update existing user with SAML info
        user.saml_nameid = nameid
        user.is_saml_user = True
        if extracted_name and extracted_name.strip():
            user.full_name = extracted_name.strip()
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        logger.info("saml_user_updated", user_id=user.id, nameid=nameid)
    else:
        # Create new user
        role = map_saml_role(attributes)
        
        user = User(
            email=extracted_email or f"{nameid}@saml.local",
            username=username,
            full_name=extracted_name.strip() if extracted_name else None,
            role=role,
            is_active=True,
            is_saml_user=True,
            saml_nameid=nameid,
            last_login=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("saml_user_created", user_id=user.id, nameid=nameid, role=role.value)
    
    return user


@router.get("/login")
async def saml_login(request: Request):
    """Initiate SAML login flow - redirect to IdP."""
    if not settings.SAML_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SAML authentication is not enabled"
        )
    
    try:
        from saml2 import BINDING_HTTP_REDIRECT
        from saml2.client import Saml2Client
        from saml2.config import Config as Saml2Config
        
        # Build SAML config
        saml_config = Saml2Config()
        saml_config.load(get_saml_settings())
        saml_config.allow_unknown_attributes = True
        
        client = Saml2Client(config=saml_config)
        
        # Create authentication request
        reqid, info = client.prepare_for_authenticate()
        
        # Get redirect URL
        for key, value in info["headers"]:
            if key == "Location":
                logger.info("saml_login_initiated", request_id=reqid)
                return RedirectResponse(url=value, status_code=302)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate SAML redirect"
        )
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="SAML library not installed"
        )
    except Exception as e:
        logger.error("saml_login_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SAML login failed: {str(e)}"
        )


@router.post("/acs")
async def saml_acs(request: Request, db: Session = Depends(get_db)):
    """Assertion Consumer Service - handle SAML response from IdP."""
    if not settings.SAML_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SAML authentication is not enabled"
        )
    
    try:
        from saml2 import BINDING_HTTP_POST
        from saml2.client import Saml2Client
        from saml2.config import Config as Saml2Config
        
        # Get SAML response from form data
        form_data = await request.form()
        saml_response = form_data.get("SAMLResponse")
        
        if not saml_response:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No SAML response received"
            )
        
        # Build SAML config
        saml_config = Saml2Config()
        saml_config.load(get_saml_settings())
        saml_config.allow_unknown_attributes = True
        
        client = Saml2Client(config=saml_config)
        
        # Parse and validate response
        authn_response = client.parse_authn_request_response(
            saml_response,
            BINDING_HTTP_POST
        )
        
        if not authn_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid SAML response"
            )
        
        # Extract user info
        nameid = authn_response.name_id.text
        attributes = authn_response.ava  # Attribute-Value Assertion
        
        # Get email and name from common attribute names
        email = attributes.get("email", attributes.get("mail", [None]))[0]
        name = attributes.get("displayName", attributes.get("cn", [None]))[0]
        
        # Provision or update user
        user = provision_saml_user(db, nameid, attributes, email, name)
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )
        
        # Create JWT tokens
        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})
        
        # Audit log
        AuditManager.log_login(db, user.id, saml=True)
        
        logger.info("saml_login_success", user_id=user.id, nameid=nameid)
        
        # Redirect to frontend with tokens
        # SECURITY: Put tokens in the URL fragment (not query params) to avoid leaking
        # them via server logs, referrers, proxies, and browser history sync.
        frontend_url = settings.CORS_ORIGINS.split(",")[0].strip()
        fragment = urlencode(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "saml": "true",
            }
        )
        redirect_url = f"{frontend_url}/login#{fragment}"
        
        return RedirectResponse(url=redirect_url, status_code=302)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("saml_acs_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SAML authentication failed"
        )


@router.get("/metadata")
async def saml_metadata():
    """Return Service Provider metadata for IdP configuration."""
    if not settings.SAML_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SAML authentication is not enabled"
        )
    
    try:
        from saml2.config import Config as Saml2Config
        from saml2.metadata import create_metadata_string
        
        saml_config = Saml2Config()
        saml_config.load(get_saml_settings())
        
        metadata = create_metadata_string(
            None,
            config=saml_config,
            valid=24 * 365,  # 1 year validity
        )
        
        return Response(
            content=metadata,
            media_type="application/xml"
        )
        
    except Exception as e:
        logger.error("saml_metadata_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate metadata"
        )


@router.get("/logout")
async def saml_logout(request: Request):
    """Initiate SAML logout (SLO)."""
    if not settings.SAML_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SAML authentication is not enabled"
        )
    
    # For now, just redirect to frontend login with logout flag
    frontend_url = settings.CORS_ORIGINS.split(",")[0].strip()
    return RedirectResponse(url=f"{frontend_url}/login?logout=true", status_code=302)


@router.get("/status")
async def saml_status():
    """Check SAML configuration status."""
    return {
        "enabled": settings.SAML_ENABLED,
        "metadata_url": settings.SAML_METADATA_URL if settings.SAML_ENABLED else None,
        "entity_id": settings.SAML_ENTITY_ID if settings.SAML_ENABLED else None,
        "acs_url": settings.SAML_ACS_URL if settings.SAML_ENABLED else None,
    }
