"""Add branding fields to business_settings

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # Check if columns already exist (safe for SQLite)
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("business_settings")}

    if "tagline" not in existing_cols:
        op.add_column("business_settings", sa.Column("tagline", sa.String(255), nullable=True))
    if "brand_color" not in existing_cols:
        op.add_column("business_settings", sa.Column("brand_color", sa.String(30), nullable=True, server_default="#111827"))
    if "upi_id" not in existing_cols:
        op.add_column("business_settings", sa.Column("upi_id", sa.String(100), nullable=True))
    if "gstin" not in existing_cols:
        op.add_column("business_settings", sa.Column("gstin", sa.String(20), nullable=True))


def downgrade() -> None:
    pass
