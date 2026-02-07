"""User management API routes for admins."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.auth.rbac import Permission
from app.auth.security import create_access_token
from app.models import User, UserRole, AuditEventType
from app.auth.schemas import UserResponse, UserUpdate, UserCreate
from app.audit.manager import AuditManager
from app.core.logging import logger

router = APIRouter(prefix="/users", tags=["users"])


# ============ ROLE SWITCHING (Admin Only) ============

class RoleSwitchRequest(BaseModel):
    """Request to switch to a different role for testing."""
    target_role: str  # The role to assume
    

class RoleSwitchResponse(BaseModel):
    """Response with new token containing assumed role."""
    access_token: str
    assumed_role: str
    original_role: str
    message: str


@router.post("/switch-role", response_model=RoleSwitchResponse)
async def switch_role(
    request: RoleSwitchRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Switch to a different role for testing purposes (Admin only).
    
    This allows admins to test the platform from the perspective of different roles.
    The switch is tracked in audit logs and all activity is traced back to the admin.
    
    The returned token contains:
    - Original admin user ID (sub)
    - Assumed role (assumed_role)
    - Flag indicating impersonation (is_impersonating)
    - Original role preserved (original_role)
    """
    # Only admins can switch roles
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can switch roles"
        )
    
    # Validate target role
    try:
        target_role = UserRole[request.target_role.upper()]
    except KeyError:
        valid_roles = [r.value for r in UserRole]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {request.target_role}. Valid roles: {valid_roles}"
        )
    
    # Get client IP
    client_ip = getattr(http_request.state, 'client_ip', None) or (
        http_request.client.host if http_request.client else None
    )
    
    # Create a new token with the assumed role
    token_data = {
        "sub": current_user.id,
        "role": target_role.value,
        "original_role": current_user.role.value,
        "is_impersonating": True,
        "impersonator_id": current_user.id,
        "impersonator_username": current_user.username,
    }
    
    new_token = create_access_token(token_data)
    
    # Log the role switch in audit
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.RBAC_CHANGE,
        action="role_switch_started",
        user_id=current_user.id,
        details={
            "original_role": current_user.role.value,
            "assumed_role": target_role.value,
            "admin_username": current_user.username,
            "admin_email": current_user.email,
            "message": f"Admin {current_user.username} switched to {target_role.value} role for testing"
        },
        ip_address=client_ip
    )
    
    logger.info(
        "role_switch",
        admin_id=current_user.id,
        admin_username=current_user.username,
        original_role=current_user.role.value,
        assumed_role=target_role.value,
        ip_address=client_ip
    )
    
    return RoleSwitchResponse(
        access_token=new_token,
        assumed_role=target_role.value,
        original_role=current_user.role.value,
        message=f"Switched to {target_role.value} role. All activity will be logged under admin {current_user.username}."
    )


@router.post("/restore-role", response_model=RoleSwitchResponse)
async def restore_role(
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Restore the original admin role after testing.
    
    This ends the role impersonation session and returns a normal admin token.
    """
    # Check the ACTUAL user role from database (not the assumed role from token)
    # When impersonating, current_user.role returns assumed role, but we need actual_role
    actual_role = getattr(current_user, 'actual_role', None) or current_user.user.role if hasattr(current_user, 'user') else current_user.role
    
    # If _impersonation_context exists, the actual role is stored there
    if hasattr(current_user, '_impersonation_context') and current_user._impersonation_context:
        actual_role = current_user._impersonation_context.get('original_role', current_user.role)
    
    # Also check the database directly to be sure
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if db_user:
        actual_role = db_user.role
    
    if actual_role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore roles"
        )
    
    # Get client IP
    client_ip = getattr(http_request.state, 'client_ip', None) or (
        http_request.client.host if http_request.client else None
    )
    
    # Create a normal admin token (no impersonation)
    token_data = {
        "sub": current_user.id,
        "role": current_user.role.value,
    }
    
    new_token = create_access_token(token_data)
    
    # Log the role restoration
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.RBAC_CHANGE,
        action="role_switch_ended",
        user_id=current_user.id,
        details={
            "restored_role": current_user.role.value,
            "admin_username": current_user.username,
            "message": f"Admin {current_user.username} restored their original role"
        },
        ip_address=client_ip
    )
    
    logger.info(
        "role_restored",
        admin_id=current_user.id,
        admin_username=current_user.username,
        ip_address=client_ip
    )
    
    return RoleSwitchResponse(
        access_token=new_token,
        assumed_role=current_user.role.value,
        original_role=current_user.role.value,
        message="Restored original admin role."
    )


@router.get("/my-permissions")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the current user's page permissions using the UNIFIED permission system.
    
    Returns which pages/features the user can access based on their effective role.
    When impersonating, returns permissions for the assumed role.
    
    Uses the single source of truth: unified_permissions.py
    """
    from app.auth.dependencies import get_effective_role, is_user_impersonating, get_impersonation_context
    from app.auth.unified_permissions import get_role_page_details, get_role_api_permissions
    
    effective_role = get_effective_role(current_user)
    is_impersonating = is_user_impersonating(current_user)
    impersonation_context = get_impersonation_context(current_user)
    
    role_name = effective_role.value if hasattr(effective_role, 'value') else str(effective_role)
    
    # Get accessible pages from unified permissions (single source of truth)
    accessible_pages = get_role_page_details(role_name)
    api_permissions = get_role_api_permissions(role_name)
    
    logger.info(
        "permissions_fetched",
        user_id=current_user.id,
        effective_role=role_name,
        is_impersonating=is_impersonating,
        accessible_pages=[p["key"] for p in accessible_pages]
    )
    
    original_role_value = None
    if impersonation_context:
        orig = impersonation_context.get("original_role")
        if orig and hasattr(orig, 'value'):
            original_role_value = orig.value
        elif isinstance(orig, str):
            original_role_value = orig
    
    return {
        "effective_role": role_name,
        "is_impersonating": is_impersonating,
        "original_role": original_role_value,
        "accessible_pages": accessible_pages,
        # Backward-compatible field name (used by older clients)
        "api_permissions": api_permissions,
        # Preferred field name (used by current frontend)
        "all_permissions": api_permissions,
    }


@router.get("/available-roles")
async def get_available_roles(
    current_user: User = Depends(get_current_user)
):
    """Get list of roles available for switching (admin only)."""
    # Check actual role (from DB) not effective role
    from app.auth.dependencies import get_impersonation_context
    
    impersonation_context = get_impersonation_context(current_user)
    actual_role = current_user.role
    
    # If impersonating, check original_role
    if impersonation_context:
        original_role = impersonation_context.get("original_role")
        if original_role:
            actual_role = original_role
    
    if actual_role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view available roles"
        )
    
    roles = [
        {"value": role.value, "label": role.value, "description": get_role_description(role)}
        for role in UserRole
    ]
    
    return {"roles": roles, "current_role": current_user.role.value}


def get_role_description(role: UserRole) -> str:
    """Get a description for each role."""
    descriptions = {
        UserRole.ADMIN: "Full system access - manages users, settings, and all platform features",
        UserRole.EXECUTIVE: "C-Suite/CISO - read-only access to reports and dashboards",
        UserRole.MANAGER: "Team leads - reports, metrics, and team oversight",
        UserRole.TI: "Threat Intelligence Analyst - article triage and analysis",
        UserRole.TH: "Threat Hunter - execute and manage hunts",
        UserRole.IR: "Incident Response - view and respond to threats",
        UserRole.VIEWER: "Read-only access to view content",
    }
    return descriptions.get(role, "Standard user role")


@router.get("/", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS.value)),
    db: Session = Depends(get_db)
):
    """List all users (admin only)."""
    users = db.query(User).all()
    return users


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS.value)),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)."""
    from app.auth.security import hash_password
    
    # Check for existing user
    existing = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    # Validate role
    try:
        role = UserRole[user_data.role.upper()] if user_data.role else UserRole.VIEWER
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {user_data.role}"
        )
    
    # Validate additional roles
    additional_roles = user_data.additional_roles or []
    valid_roles = [r.value for r in UserRole]
    for ar in additional_roles:
        if ar not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid additional role: {ar}"
            )
    
    # Create user
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=role,
        additional_roles=additional_roles,
        custom_permissions=user_data.custom_permissions or {"grant": [], "deny": []},
        is_active=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Audit log
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.RBAC_CHANGE,
        action="user_created",
        user_id=current_user.id,
        details={"new_username": user.username, "role": role.value},
        resource_type="user",
        resource_id=user.id
    )
    
    logger.info("user_created", user_id=user.id, created_by=current_user.id)
    
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS.value)),
    db: Session = Depends(get_db)
):
    """Get a specific user by ID (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS.value)),
    db: Session = Depends(get_db)
):
    """Update user details (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deactivating themselves
    if user_id == current_user.id and user_update.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    changes = []
    
    # Update fields if provided
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
        changes.append("full_name")
    
    if user_update.email is not None:
        user.email = user_update.email
        changes.append("email")
    
    if user_update.role is not None:
        try:
            old_role = user.role.value if hasattr(user.role, 'value') else user.role
            user.role = UserRole[user_update.role]
            changes.append(f"role: {old_role} -> {user_update.role}")
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {user_update.role}"
            )
    
    # Handle additional roles (multi-role support)
    if user_update.additional_roles is not None:
        # Validate all additional roles
        valid_roles = [r.value for r in UserRole]
        for role in user_update.additional_roles:
            if role not in valid_roles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid additional role: {role}. Valid roles: {valid_roles}"
                )
        user.additional_roles = user_update.additional_roles
        changes.append(f"additional_roles: {user_update.additional_roles}")
    
    # Handle custom permissions (per-user overrides)
    if user_update.custom_permissions is not None:
        # Validate structure
        if not isinstance(user_update.custom_permissions, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="custom_permissions must be an object with 'grant' and 'deny' arrays"
            )
        grant = user_update.custom_permissions.get("grant", [])
        deny = user_update.custom_permissions.get("deny", [])
        if not isinstance(grant, list) or not isinstance(deny, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="custom_permissions.grant and custom_permissions.deny must be arrays"
            )
        user.custom_permissions = {
            "grant": grant,
            "deny": deny
        }
        changes.append(f"custom_permissions: grant={len(grant)}, deny={len(deny)}")
    
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
        changes.append(f"is_active: {user_update.is_active}")
    
    db.commit()
    db.refresh(user)
    
    # Audit log
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.RBAC_CHANGE,
        action="user_updated",
        user_id=current_user.id,
        details={"username": user.username, "changes": changes},
        resource_type="user",
        resource_id=user.id
    )
    
    logger.info("user_updated", user_id=user.id, updated_by=current_user.id, changes=changes)
    
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS.value)),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    username = user.username
    
    db.delete(user)
    db.commit()
    
    # Audit log
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.RBAC_CHANGE,
        action="user_deleted",
        user_id=current_user.id,
        details={"deleted_username": username},
        resource_type="user",
        resource_id=user_id
    )
    
    logger.info("user_deleted", user_id=user_id, deleted_by=current_user.id)
    
    return {"message": f"User {username} deleted successfully"}
