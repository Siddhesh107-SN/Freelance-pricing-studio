"""Deactivate Deployment features in all categories

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE features SET active = 0 WHERE name = 'Deployment'")


def downgrade() -> None:
    op.execute("UPDATE features SET active = 1 WHERE name = 'Deployment'")
