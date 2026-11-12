from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class EstimateItem(Base):
    __tablename__ = "estimate_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    estimate_id: Mapped[int] = mapped_column(ForeignKey("estimates.id", ondelete="CASCADE"), index=True)
    feature_id: Mapped[int | None] = mapped_column(ForeignKey("features.id"), nullable=True)
    feature_name_snapshot: Mapped[str] = mapped_column(String(160))
    description_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    estimated_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)  # line total
    assigned_team_member_id: Mapped[int | None] = mapped_column(ForeignKey("team_members.id"), nullable=True)
    internal_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)  # line total
    total_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
