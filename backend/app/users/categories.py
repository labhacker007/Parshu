"""
Category management for user-defined feed organization.
Allows users to create custom categories, assign colors/icons,
and organize feeds via drag & drop.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models import User, Category, UserFeed
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/users/categories", tags=["user-categories"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")  # Hex color
    icon: Optional[str] = Field(None, max_length=50)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = None


class CategoryResponse(BaseModel):
    id: int
    user_id: int
    name: str
    color: Optional[str]
    icon: Optional[str]
    sort_order: int
    feed_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Routes
# ============================================================================

@router.get("/", response_model=List[CategoryResponse])
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all categories for the current user, ordered by sort_order."""
    categories = db.query(Category).filter(
        Category.user_id == current_user.id
    ).order_by(Category.sort_order, Category.name).all()

    # Add feed count to each category
    result = []
    for cat in categories:
        feed_count = db.query(UserFeed).filter(
            UserFeed.user_id == current_user.id,
            UserFeed.category_id == cat.id
        ).count()

        result.append(
            CategoryResponse(
                id=cat.id,
                user_id=cat.user_id,
                name=cat.name,
                color=cat.color,
                icon=cat.icon,
                sort_order=cat.sort_order,
                feed_count=feed_count,
                created_at=cat.created_at,
                updated_at=cat.updated_at
            )
        )

    return result


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new category for the current user."""
    # Check for duplicate name
    existing = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.name == payload.name
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category '{payload.name}' already exists"
        )

    # Get max sort_order for new category
    max_order = db.query(Category).filter(
        Category.user_id == current_user.id
    ).count()

    category = Category(
        user_id=current_user.id,
        name=payload.name,
        color=payload.color or "#1890ff",  # Default blue
        icon=payload.icon or "FolderOutlined",
        sort_order=max_order
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return CategoryResponse(
        id=category.id,
        user_id=category.user_id,
        name=category.name,
        color=category.color,
        icon=category.icon,
        sort_order=category.sort_order,
        feed_count=0,
        created_at=category.created_at,
        updated_at=category.updated_at
    )


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update category details (name, color, icon, sort_order)."""
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check for name conflict if renaming
    if payload.name and payload.name != category.name:
        existing = db.query(Category).filter(
            Category.user_id == current_user.id,
            Category.name == payload.name
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category '{payload.name}' already exists"
            )

        category.name = payload.name

    if payload.color is not None:
        category.color = payload.color

    if payload.icon is not None:
        category.icon = payload.icon

    if payload.sort_order is not None:
        category.sort_order = payload.sort_order

    db.commit()
    db.refresh(category)

    # Get feed count
    feed_count = db.query(UserFeed).filter(
        UserFeed.user_id == current_user.id,
        UserFeed.category_id == category.id
    ).count()

    return CategoryResponse(
        id=category.id,
        user_id=category.user_id,
        name=category.name,
        color=category.color,
        icon=category.icon,
        sort_order=category.sort_order,
        feed_count=feed_count,
        created_at=category.created_at,
        updated_at=category.updated_at
    )


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a category. Associated feeds will have category_id set to NULL.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Update feeds to remove category reference (SET NULL)
    db.query(UserFeed).filter(
        UserFeed.category_id == category_id
    ).update({"category_id": None})

    db.delete(category)
    db.commit()

    return {"message": f"Category '{category.name}' deleted successfully"}


@router.post("/reorder")
def reorder_categories(
    category_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reorder categories by providing a list of category IDs in desired order.
    Used for drag & drop reordering.
    """
    # Verify all categories belong to current user
    categories = db.query(Category).filter(
        Category.id.in_(category_ids),
        Category.user_id == current_user.id
    ).all()

    if len(categories) != len(category_ids):
        raise HTTPException(
            status_code=400,
            detail="Some category IDs are invalid or don't belong to you"
        )

    # Update sort_order for each category
    for idx, cat_id in enumerate(category_ids):
        db.query(Category).filter(Category.id == cat_id).update(
            {"sort_order": idx}
        )

    db.commit()

    return {"message": "Categories reordered successfully"}
