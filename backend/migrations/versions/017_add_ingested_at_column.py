"""Add ingested_at column to articles for dual date tracking

Revision ID: 017_add_ingested_at
Revises: 016_guardrails_tables
Create Date: 2026-01-29

This migration adds a separate ingested_at column to track when HuntSphere
ingested each article, distinct from published_at which is the original
article publication date from the source.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '017_add_ingested_at'
down_revision = '016_guardrails_tables'
branch_labels = None
depends_on = None


def upgrade():
    """Add ingested_at column to articles table."""
    
    # Add the ingested_at column
    op.add_column(
        'articles',
        sa.Column('ingested_at', sa.DateTime(), nullable=True, index=True)
    )
    
    # Populate ingested_at from created_at for existing articles
    op.execute("""
        UPDATE articles 
        SET ingested_at = created_at 
        WHERE ingested_at IS NULL
    """)
    
    # Create index for faster queries on ingested_at
    op.create_index('idx_article_ingested', 'articles', ['ingested_at'])


def downgrade():
    """Remove ingested_at column."""
    op.drop_index('idx_article_ingested', table_name='articles')
    op.drop_column('articles', 'ingested_at')
