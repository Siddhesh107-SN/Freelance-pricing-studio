from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class Feature(TimestampMixin, Base):
    __tablename__ = "features"
    __table_args__ = (Index("ix_features_category_active", "category_id", "active"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("service_categories.id"))
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    basic_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    intermediate_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    advanced_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    estimated_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    # Optional flat internal cost per unit. When 0, internal cost = hours x assigned developer rate.
    default_internal_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
