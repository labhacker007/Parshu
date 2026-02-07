"""Auth API endpoints for login, token management, and SAML."""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.auth.schemas import LoginRequest, LoginResponse, TokenRefreshRequest, TokenRefreshResponse, UserResponse, UserCreate
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    DUMMY_PASSWORD_HASH,
)
from app.auth.dependencies import get_current_user
from app.models import User
from app.audit.manager import AuditManager
from app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(user_create: UserCreate, db: Session = Depends(get_db)):
    """Register a new user (local auth only)."""
    # Basic password policy (avoid weak credentials by default)
    if not user_create.password or len(user_create.password) < 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 12 characters long"
        )

    # Check if user already exists
    existing = db.query(User).filter(
        (User.email == user_create.email) | (User.username == user_create.username)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered"
        )
    
    # Create new user
    user = User(
        email=user_create.email,
        username=user_create.username,
        hashed_password=hash_password(user_create.password),
        full_name=user_create.full_name,
        is_saml_user=False
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info("user_registered", user_id=user.id, username=user.username)
    
    return user


@router.post("/login", response_model=LoginResponse)
def login(login_request: LoginRequest, db: Session = Depends(get_db)):
    """Local email/password + OTP login. Accepts email or username.
    
    Security features:
    - Constant-time comparison to prevent timing attacks
    - Rate limiting applied via middleware
    - Generic error messages to prevent user enumeration
    """
    import hmac
    
    # Input validation
    if not login_request.email or len(login_request.email) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input"
        )
    
    if not login_request.password or len(login_request.password) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input"
        )
    
    # Support login by either email or username
    user = db.query(User).filter(
        (User.email == login_request.email) | (User.username == login_request.email)
    ).first()
    
    # Use a dummy verify to reduce timing side-channels between "user not found" and "bad password"
    try:
        verify_password(login_request.password, DUMMY_PASSWORD_HASH)
    except Exception:
        pass

    # Verify credentials
    credentials_valid = False
    if user and user.hashed_password:
        credentials_valid = verify_password(login_request.password, user.hashed_password)
    
    # Generic error message to prevent user enumeration
    if not user or not credentials_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # Check OTP if enabled
    if user.otp_enabled and settings.ENABLE_OTP:
        if not login_request.otp_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="OTP required"
            )
        
        from app.auth.security import verify_totp
        if not verify_totp(user.otp_secret, login_request.otp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid OTP code"
            )
    
    # Create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    # Update last login
    from datetime import datetime
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Audit log
    AuditManager.log_login(db, user.id, saml=False)
    
    logger.info("user_login_success", user_id=user.id, username=user.username)
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_token(refresh_request: TokenRefreshRequest):
    """Refresh access token using a valid refresh token."""
    try:
        payload = decode_token(refresh_request.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        user_id = payload.get("sub")
        access_token = create_access_token({"sub": user_id})
        return TokenRefreshResponse(access_token=access_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log out a user (token blacklist in production)."""
    logger.info("user_logout", user_id=current_user.id, username=current_user.username)
    return {"message": "Logged out successfully"}


# ============================================================================
# OTP / Two-Factor Authentication Endpoints
# ============================================================================

from pydantic import BaseModel


class OTPEnableResponse(BaseModel):
    """Response for OTP setup initiation."""
    secret: str
    qr_code_data_url: str
    manual_entry_key: str
    issuer: str
    account_name: str


class OTPVerifyRequest(BaseModel):
    """Request to verify OTP code during setup."""
    code: str


class OTPDisableRequest(BaseModel):
    """Request to disable OTP (requires password confirmation)."""
    password: str


@router.post("/otp/enable", response_model=OTPEnableResponse)
def enable_otp_setup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate OTP/2FA setup for the current user.
    
    Returns:
    - secret: The TOTP secret (base32 encoded)
    - qr_code_data_url: Base64 encoded QR code image for Google Authenticator
    - manual_entry_key: Secret formatted for manual entry
    - issuer: App name for authenticator display
    - account_name: User's email for authenticator display
    
    After calling this endpoint, the user must verify with /otp/verify
    to actually enable OTP.
    """
    from app.auth.security import generate_otp_secret
    import pyotp
    import qrcode
    import qrcode.image.svg
    from io import BytesIO
    import base64
    
    # Generate new secret
    secret = generate_otp_secret()
    
    # Create TOTP provisioning URI for QR code
    issuer = settings.APP_NAME or "Parshu"
    account_name = current_user.email
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=account_name,
        issuer_name=issuer
    )
    
    # Generate QR code as PNG data URL
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64 data URL
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    qr_code_data_url = f"data:image/png;base64,{qr_code_base64}"
    
    # Store secret temporarily (not enabled until verified)
    # We'll store it but keep otp_enabled = False
    current_user.otp_secret = secret
    db.commit()
    
    logger.info("otp_setup_initiated", user_id=current_user.id, email=current_user.email)
    
    return OTPEnableResponse(
        secret=secret,
        qr_code_data_url=qr_code_data_url,
        manual_entry_key=secret,
        issuer=issuer,
        account_name=account_name
    )


@router.post("/otp/verify")
def verify_otp_setup(
    request: OTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify OTP code to complete 2FA setup.
    
    The user must enter a valid code from their authenticator app
    to confirm they've successfully set up the secret.
    """
    from app.auth.security import verify_totp
    
    if not current_user.otp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP setup not initiated. Call /otp/enable first."
        )
    
    # Verify the code
    if not verify_totp(current_user.otp_secret, request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please try again."
        )
    
    # Enable OTP
    current_user.otp_enabled = True
    db.commit()
    
    # Audit log
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type="security",
        action="OTP/2FA enabled",
        resource_type="user_security"
    )
    
    logger.info("otp_enabled", user_id=current_user.id, email=current_user.email)
    
    return {
        "message": "Two-factor authentication enabled successfully",
        "otp_enabled": True
    }


@router.post("/otp/disable")
def disable_otp(
    request: OTPDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disable OTP/2FA for the current user.
    
    Requires password confirmation for security.
    """
    # Verify password
    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    if not current_user.otp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP is not enabled for this account"
        )
    
    # Disable OTP
    current_user.otp_enabled = False
    current_user.otp_secret = None
    db.commit()
    
    # Audit log
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type="security",
        action="OTP/2FA disabled",
        resource_type="user_security"
    )
    
    logger.info("otp_disabled", user_id=current_user.id, email=current_user.email)
    
    return {
        "message": "Two-factor authentication disabled",
        "otp_enabled": False
    }


@router.get("/otp/status")
def get_otp_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get current OTP/2FA status for the authenticated user.
    """
    return {
        "otp_enabled": current_user.otp_enabled,
        "otp_configured": bool(current_user.otp_secret),
        "system_otp_enabled": settings.ENABLE_OTP
    }


@router.get("/security/settings")
def get_security_settings(
    current_user: User = Depends(get_current_user)
):
    """
    Get security settings and available authentication options.
    """
    return {
        "user": {
            "otp_enabled": current_user.otp_enabled,
            "is_saml_user": current_user.is_saml_user
        },
        "system": {
            "otp_available": settings.ENABLE_OTP,
            "saml_available": settings.SAML_ENABLED,
            "local_auth_available": True
        }
    }
