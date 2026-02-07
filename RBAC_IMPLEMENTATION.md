# RBAC (Role-Based Access Control) Implementation

## Overview

A comprehensive Role-Based Access Control (RBAC) system has been implemented for the HuntSphere platform. This system allows administrators to manage permissions at both the role level and individual user level through a user-friendly interface.

## Architecture

### Backend Components

#### 1. Database Schema (`backend/migrations/versions/007_add_rbac_tables.py`)

Two new tables have been created:

**`role_permissions` Table:**
- Stores permissions granted to each role
- Columns:
  - `id`: Primary key
  - `role`: Role name (ADMIN, TI, TH, IR, VIEWER)
  - `permission`: Permission key (e.g., "read:articles")
  - `granted`: Boolean flag
  - `description`: Human-readable description
  - `created_at`, `updated_at`: Timestamps
- Unique constraint on (role, permission)
- Index on role for fast lookups

**`user_permission_overrides` Table:**
- Stores user-specific permission overrides
- Columns:
  - `id`: Primary key
  - `user_id`: Foreign key to users table
  - `permission`: Permission key
  - `granted`: Boolean (true = grant, false = deny)
  - `reason`: Text explanation for the override
  - `created_by_id`: Admin who created the override
  - `created_at`, `updated_at`: Timestamps
- Unique constraint on (user_id, permission)
- Cascading delete when user is deleted
- Index on user_id for fast lookups

#### 2. RBAC Service (`backend/app/admin/rbac_service.py`)

A comprehensive service layer that handles all RBAC operations:

**Key Methods:**
- `get_all_permissions()`: Returns all available permissions in the system
- `get_all_roles()`: Returns all user roles
- `get_role_permissions(role)`: Get permissions for a specific role
- `update_role_permissions(role, permissions)`: Update role permissions
- `get_user_permission_overrides(user_id)`: Get user-specific overrides
- `set_user_permission_override(user_id, permission, granted, reason)`: Add/update user override
- `remove_user_permission_override(user_id, permission)`: Remove user override
- `get_effective_user_permissions(user_id, role)`: Calculate final permissions (role + overrides)
- `get_permission_matrix()`: Get full matrix of roles × permissions

**Features:**
- Automatic fallback to hardcoded defaults if database is empty
- Comprehensive error handling and logging
- Audit trail integration

#### 3. Updated Permission Enum (`backend/app/auth/rbac.py`)

Added new admin permissions:
- `MANAGE_GENAI = "manage:genai"`: Manage GenAI settings
- `MANAGE_KNOWLEDGE = "manage:knowledge"`: Manage knowledge base
- `MANAGE_RBAC = "manage:rbac"`: Manage RBAC permissions

#### 4. API Endpoints (`backend/app/admin/routes.py`)

New RBAC management endpoints:

**Role Management:**
- `GET /admin/rbac/permissions`: List all available permissions
- `GET /admin/rbac/roles`: List all roles
- `GET /admin/rbac/matrix`: Get full permission matrix
- `PUT /admin/rbac/roles/{role}/permissions`: Update role permissions

**User Overrides:**
- `GET /admin/rbac/users/{user_id}/permissions`: Get user overrides
- `POST /admin/rbac/users/{user_id}/permissions`: Set user permission override
- `DELETE /admin/rbac/users/{user_id}/permissions/{permission}`: Remove override

All endpoints:
- Require `manage:rbac` permission
- Include audit logging
- Return structured error messages
- Include validation

### Frontend Components

#### 1. API Client (`frontend/src/api/client.js`)

New `rbacAPI` object with methods matching backend endpoints:
```javascript
rbacAPI.getPermissions()
rbacAPI.getRoles()
rbacAPI.getMatrix()
rbacAPI.updateRolePermissions(role, permissions)
rbacAPI.getUserPermissions(userId)
rbacAPI.setUserPermission(userId, permission, granted, reason)
rbacAPI.removeUserPermission(userId, permission)
```

#### 2. RBACManager Component (`frontend/src/components/RBACManager.js`)

A comprehensive UI component with two main sections:

**Permission Matrix Tab:**
- Visual grid showing all roles (columns) × permissions (rows)
- Permissions grouped by category (Articles, Hunts, Intelligence, Reports, Admin)
- Toggle switches to grant/revoke permissions
- Changes save immediately
- Loading states and error handling
- Informational alerts

**User Overrides Tab:**
- Dropdown to select a user
- Displays user's role and effective permission count
- Table showing all current overrides
- Add Override button opens modal with:
  - Permission selector
  - Grant/Deny toggle
  - Reason text field
- Remove override functionality with confirmation

**Features:**
- Real-time updates
- Responsive design
- Comprehensive error handling
- Success/error messages
- Professional UI with Ant Design components

#### 3. Admin Page Integration (`frontend/src/pages/Admin.js`)

- New "Access Control" tab added to Admin dashboard
- Imports RBACManager component
- Added LockOutlined icon
- Tab appears alongside other admin functions

## Default Permissions

### ADMIN Role (Full Access)
- All permissions granted by default

### TI (Threat Intelligence) Role
- Read/triage/analyze articles
- Create summaries
- Read hunts
- Create hunts
- Read/extract intelligence
- Read/create/share reports
- Read sources

### TH (Threat Hunter) Role
- Read articles
- Read/create/execute/manage hunts
- Read intelligence
- Read reports
- Read sources

### IR (Incident Response) Role
- Read/triage articles
- Read/execute hunts
- Read intelligence
- Read/share reports
- Read sources

### VIEWER Role (Read-Only)
- Read articles
- Read hunts
- Read intelligence
- Read reports
- Read sources

## Usage

### For Administrators

1. **Access the RBAC Manager:**
   - Navigate to Admin Dashboard
   - Click on "Access Control" tab
   - Requires `manage:rbac` permission (ADMIN role by default)

2. **Manage Role Permissions:**
   - Switch to "Permission Matrix" tab
   - View all roles and their permissions
   - Toggle switches to grant/revoke permissions
   - Changes save immediately
   - Permissions are grouped by category

3. **Manage User Overrides:**
   - Switch to "User Overrides" tab
   - Select a user from the dropdown
   - View their current role and overrides
   - Click "Add Override" to create a new override
   - Select permission, choose Grant/Deny, add reason
   - Click remove icon to delete an override

### For Developers

**Check if a user has a permission:**
```python
from app.admin.rbac_service import RBACService

# Get effective permissions
permissions = RBACService.get_effective_user_permissions(db, user_id, user_role)
has_access = "read:articles" in permissions
```

**Protect an endpoint:**
```python
from app.auth.rbac import Permission
from app.auth.dependencies import require_permission

@router.get("/protected")
def protected_endpoint(
    current_user: User = Depends(require_permission(Permission.MANAGE_RBAC.value)),
    db: Session = Depends(get_db)
):
    # Only users with manage:rbac permission can access
    return {"message": "Access granted"}
```

**Audit RBAC changes:**
```python
AuditManager.log_event(
    db=db,
    user_id=current_user.id,
    event_type="RBAC_CHANGE",
    action=f"Updated permissions for role {role}",
    resource_type="role_permissions",
    resource_id=role,
    metadata={"permissions": permissions}
)
```

## Database Migration

The migration was applied manually:

```bash
docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db
# Tables created: role_permissions, user_permission_overrides
# Default permissions inserted for all roles
```

Migration file: `backend/migrations/versions/007_add_rbac_tables.py`

## Security Considerations

1. **Permission Checks:**
   - All RBAC endpoints require `manage:rbac` permission
   - Only ADMIN role has this permission by default
   - Cannot be bypassed through user overrides

2. **Audit Trail:**
   - All permission changes are logged
   - Includes who made the change and when
   - Tracks both role updates and user overrides

3. **Cascade Deletes:**
   - User overrides are automatically deleted when user is deleted
   - Prevents orphaned permission records

4. **Validation:**
   - Role names validated against UserRole enum
   - Permission keys validated against Permission enum
   - Prevents invalid data from being stored

## Testing

### Test RBAC API:
```bash
# Get permission matrix
curl http://localhost:8000/admin/rbac/matrix \
  -H "Authorization: Bearer <admin_token>"

# Update role permissions
curl -X PUT http://localhost:8000/admin/rbac/roles/TI/permissions \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"permissions": ["read:articles", "create:reports"]}'

# Set user override
curl -X POST http://localhost:8000/admin/rbac/users/2/permissions \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"permission": "manage:hunts", "granted": true, "reason": "Temporary access"}'
```

### Test UI:
1. Login as admin
2. Navigate to Admin Dashboard → Access Control
3. Toggle some permissions in the matrix
4. Select a user and add an override
5. Verify changes are reflected in the database

## Future Enhancements

1. **Page-Level Access Control:**
   - Define which pages each role can access
   - Conditionally render navigation items
   - Redirect unauthorized users

2. **Permission Groups:**
   - Create named permission sets
   - Assign groups to users
   - Simplify bulk permission management

3. **Time-Based Permissions:**
   - Grant temporary access
   - Auto-revoke after expiration
   - Schedule permission changes

4. **Permission Request Workflow:**
   - Users can request additional permissions
   - Approval workflow for admins
   - Notifications and tracking

5. **Advanced Audit:**
   - View who has a specific permission
   - Track permission usage
   - Alert on suspicious permission changes

6. **API Key Permissions:**
   - Extend RBAC to API keys
   - Scope API access by permission
   - Audit API key usage

## Files Modified/Created

### Backend:
- ✅ `backend/app/auth/rbac.py` - Added new permissions
- ✅ `backend/app/admin/rbac_service.py` - **NEW** RBAC service
- ✅ `backend/app/admin/routes.py` - Added RBAC endpoints
- ✅ `backend/migrations/versions/007_add_rbac_tables.py` - **NEW** Migration
- ✅ `backend/app/articles/routes.py` - Added intelligence_count field
- ✅ `backend/app/articles/schemas.py` - Added intelligence_count field
- ✅ `backend/app/models.py` - Imported UserRole

### Frontend:
- ✅ `frontend/src/api/client.js` - Added rbacAPI
- ✅ `frontend/src/components/RBACManager.js` - **NEW** RBAC UI
- ✅ `frontend/src/pages/Admin.js` - Added RBAC tab

### Database:
- ✅ `role_permissions` table created
- ✅ `user_permission_overrides` table created
- ✅ Default permissions inserted

## Summary

The RBAC system provides:
- ✅ Granular permission control at role level
- ✅ User-specific permission overrides
- ✅ Visual permission matrix management
- ✅ Audit trail for all changes
- ✅ RESTful API for programmatic access
- ✅ Professional UI integrated into Admin dashboard
- ✅ Comprehensive error handling
- ✅ Database-backed persistence
- ✅ Backward compatible with existing roles

This implementation gives administrators complete control over who can access what functionality in the HuntSphere platform, with the flexibility to override role defaults for individual users when needed.
