"""Add GenAI admin models - prompts, skills, guardrails, function configs

Revision ID: 001_genai_admin
Revises:
Create Date: 2026-02-07 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_genai_admin'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create prompts table
    op.create_table('prompts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('function_type', sa.String(length=50), nullable=False),
        sa.Column('template', sa.Text(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('model_id', sa.String(length=100), nullable=True),
        sa.Column('temperature', sa.Float(), nullable=False, server_default='0.7'),
        sa.Column('max_tokens', sa.Integer(), nullable=False, server_default='500'),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_id'], ['prompts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_prompt_function_type', 'prompts', ['function_type'])
    op.create_index('idx_prompt_active', 'prompts', ['is_active'])

    # Create prompt_variables table
    op.create_table('prompt_variables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False, server_default='string'),
        sa.Column('default_value', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_prompt_variable_prompt', 'prompt_variables', ['prompt_id'])

    # Create skills table
    op.create_table('skills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('instruction', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_skill_active', 'skills', ['is_active'])

    # Create guardrails table
    op.create_table('guardrails',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False, server_default='retry'),
        sa.Column('max_retries', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_guardrail_type', 'guardrails', ['type'])
    op.create_index('idx_guardrail_active', 'guardrails', ['is_active'])

    # Create prompt_skills junction table
    op.create_table('prompt_skills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('prompt_id', 'skill_id', name='uq_prompt_skill')
    )
    op.create_index('idx_prompt_skill_prompt', 'prompt_skills', ['prompt_id'])

    # Create prompt_guardrails junction table
    op.create_table('prompt_guardrails',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=False),
        sa.Column('guardrail_id', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['guardrail_id'], ['guardrails.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('prompt_id', 'guardrail_id', name='uq_prompt_guardrail')
    )
    op.create_index('idx_prompt_guardrail_prompt', 'prompt_guardrails', ['prompt_id'])

    # Create genai_function_configs table
    op.create_table('genai_function_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('function_name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('active_prompt_id', sa.Integer(), nullable=True),
        sa.Column('primary_model_id', sa.String(length=100), nullable=True),
        sa.Column('secondary_model_id', sa.String(length=100), nullable=True),
        sa.Column('total_requests', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_cost', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('updated_by_id', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['active_prompt_id'], ['prompts.id'], ),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('function_name', name='uq_function_name')
    )
    op.create_index('idx_function_config_name', 'genai_function_configs', ['function_name'])

    # Create prompt_execution_logs table
    op.create_table('prompt_execution_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=True),
        sa.Column('function_name', sa.String(length=100), nullable=True),
        sa.Column('input_variables', sa.JSON(), nullable=True),
        sa.Column('final_prompt', sa.Text(), nullable=True),
        sa.Column('model_used', sa.String(length=100), nullable=True),
        sa.Column('temperature', sa.Float(), nullable=True),
        sa.Column('max_tokens', sa.Integer(), nullable=True),
        sa.Column('response', sa.Text(), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('cost', sa.Float(), nullable=True),
        sa.Column('guardrails_passed', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('guardrail_failures', sa.JSON(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_execution_log_function', 'prompt_execution_logs', ['function_name'])
    op.create_index('idx_execution_log_timestamp', 'prompt_execution_logs', ['timestamp'])
    op.create_index('idx_execution_log_user', 'prompt_execution_logs', ['user_id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('idx_execution_log_user', table_name='prompt_execution_logs')
    op.drop_index('idx_execution_log_timestamp', table_name='prompt_execution_logs')
    op.drop_index('idx_execution_log_function', table_name='prompt_execution_logs')
    op.drop_table('prompt_execution_logs')

    op.drop_index('idx_function_config_name', table_name='genai_function_configs')
    op.drop_table('genai_function_configs')

    op.drop_index('idx_prompt_guardrail_prompt', table_name='prompt_guardrails')
    op.drop_table('prompt_guardrails')

    op.drop_index('idx_prompt_skill_prompt', table_name='prompt_skills')
    op.drop_table('prompt_skills')

    op.drop_index('idx_guardrail_active', table_name='guardrails')
    op.drop_index('idx_guardrail_type', table_name='guardrails')
    op.drop_table('guardrails')

    op.drop_index('idx_skill_active', table_name='skills')
    op.drop_table('skills')

    op.drop_index('idx_prompt_variable_prompt', table_name='prompt_variables')
    op.drop_table('prompt_variables')

    op.drop_index('idx_prompt_active', table_name='prompts')
    op.drop_index('idx_prompt_function_type', table_name='prompts')
    op.drop_table('prompts')
