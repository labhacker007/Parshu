from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.security import decode_token
from app.auth.rbac import has_permission
from app.auth.rbac import Permission
from app.models import User, UserRole
from app.core.logging import logger
from typing import Optional

security = HTTPBearer()


class UserWithImpersonation:
    """
    Wrapper that holds the actual user and impersonation context.
    
    When an admin switches roles, we need to:
    1. Keep track of the original admin for audit purposes
    2. Use the assumed role for permission checks
    3. Still reference the real user for data operations
    """
    def __init__(self, user: User, assumed_role: Optional[UserRole] = None, 
                 is_impersonating: bool = False, impersonator_username: Optional[str] = None):
        self.user = user
        self.assumed_role = assumed_role
        self.is_impersonating = is_impersonating
        self.impersonator_username = impersonator_username
    
    @property
    def effective_role(self) -> UserRole:
        """The role to use for permission checks."""
        return self.assumed_role if self.is_impersonating and self.assumed_role else self.user.role
    
    # Proxy common User attributes for compatibility
    @property
    def id(self):
        return self.user.id
    
    @property
    def email(self):
        return self.user.email
    
    @property
    def username(self):
        return self.user.username
    
    @property
    def role(self):
        """Returns assumed role if impersonating, otherwise actual role."""
        return self.effective_role
    
    @property
    def actual_role(self):
        """Always returns the actual user role."""
        return self.user.role
    
    @property
    def is_active(self):
        return self.user.is_active
    
    @property
    def full_name(self):
        return self.user.full_name


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Extract and validate JWT from request headers.
    
    Handles role impersonation by checking for impersonation flags in the token.
    Returns the actual User object but with impersonation context attached.
    """
    try:
        payload = decode_token(credentials.credentials)
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        try:
            user_id = int(user_id_raw)
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except ValueError as e:
        logger.error("token_decode_failed", error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    
    # Check for role impersonation
    is_impersonating = payload.get("is_impersonating", False)
    if is_impersonating:
        # Defense-in-depth: only actual ADMIN users may impersonate roles
        from app.models import UserRole
        if user.role != UserRole.ADMIN:
            logger.warning("impersonation_claim_rejected_non_admin", user_id=user.id, username=user.username)
            return user

        assumed_role_str = payload.get("role")
        impersonator_username = payload.get("impersonator_username")
        
        assumed_role = None
        if assumed_role_str:
            try:
                assumed_role = UserRole[assumed_role_str]
            except Exception:
                try:
                    assumed_role = UserRole(assumed_role_str)
                except Exception:
                    assumed_role = None
        
        if assumed_role:
            # Attach impersonation context to the user object
            user._impersonation_context = {
                "is_impersonating": True,
                "assumed_role": assumed_role,
                "original_role": user.role,
                "impersonator_username": impersonator_username,
            }
            
            logger.debug(
                "impersonation_active",
                user_id=user.id,
                username=user.username,
                assumed_role=assumed_role.value,
                original_role=user.role.value
            )
    
    return user


def get_effective_role(user: User) -> UserRole:
    """Get the effective role for a user, considering impersonation."""
    if hasattr(user, '_impersonation_context') and user._impersonation_context:
        return user._impersonation_context.get("assumed_role", user.role)
    return user.role


def is_user_impersonating(user: User) -> bool:
    """Check if the user is currently impersonating another role."""
    return hasattr(user, '_impersonation_context') and user._impersonation_context.get("is_impersonating", False)


def get_impersonation_context(user: User) -> Optional[dict]:
    """Get the full impersonation context for a user."""
    if hasattr(user, '_impersonation_context'):
        return user._impersonation_context
    return None


def require_permission(required_permission: str):
    """Decorator to enforce role-based access control.
    
    Uses the effective role (assumed role if impersonating) for permission checks.
    Now also checks:
    1. Custom permissions (grant/deny per user)
    2. Additional roles assigned to the user
    3. Primary role permissions
    """
    async def permission_check(user: User = Depends(get_current_user)):
        # Check custom permissions first (highest priority)
        custom_perms = getattr(user, 'custom_permissions', None) or {}
        
        # If permission is explicitly denied, block access
        denied_perms = custom_perms.get('deny', [])
        if required_permission in denied_perms:
            logger.warning(
                "permission_explicitly_denied",
                user_id=user.id,
                required_permission=required_permission,
                reason="custom_deny"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{required_permission}' explicitly denied for this user"
            )
        
        # If permission is explicitly granted, allow access
        granted_perms = custom_perms.get('grant', [])
        if required_permission in granted_perms:
            logger.debug(
                "permission_explicitly_granted",
                user_id=user.id,
                required_permission=required_permission
            )
            return user
        
        effective_role = get_effective_role(user)
        role_name = effective_role.value if hasattr(effective_role, 'value') else str(effective_role)

        # Single source-of-truth: role->permission mapping in app.auth.rbac
        if has_permission(effective_role, required_permission):
            return user

        # Check additional roles (multi-role support)
        additional_roles = getattr(user, 'additional_roles', []) or []
        for add_role in additional_roles:
            try:
                add_role_enum = UserRole(add_role)
            except Exception:
                continue
            if has_permission(add_role_enum, required_permission):
                logger.debug(
                    "permission_granted_via_additional_role",
                    user_id=user.id,
                    required_permission=required_permission,
                    additional_role=add_role
                )
                return user
        
        # Permission denied
        role_display = role_name
        if is_user_impersonating(user):
            role_display = f"{role_name} (impersonated by {user.username})"
        
        logger.warning(
            "permission_denied",
            user_id=user.id,
            required_permission=required_permission,
            effective_role=role_name,
            additional_roles=additional_roles,
            actual_role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            is_impersonating=is_user_impersonating(user)
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{required_permission}' not granted for role '{role_display}'"
        )
    
    return permission_check
