"""Initial schema

Revision ID: 0001
Revises:
"""
import app.models  # noqa: F401
from app.database.base import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Creates every table from the models as they were at this revision.
    # Later schema changes: edit models, then `alembic revision --autogenerate -m "message"`.
    from alembic import op
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    from alembic import op
    Base.metadata.drop_all(bind=op.get_bind())
