from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

M = Numeric(14, 2)


class Estimate(TimestampMixin, Base):
    __tablename__ = "estimates"
    __table_args__ = (Index("ix_estimates_status", "status"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    estimate_number: Mapped[str] = mapped_column(String(40), unique=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    project_name: Mapped[str] = mapped_column(String(200))
    project_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("service_categories.id"), nullable=True)
    complexity: Mapped[str] = mapped_column(String(20), default="basic")
    pricing_method: Mapped[str] = mapped_column(String(20), default="feature")
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    subtotal: Mapped[Decimal] = mapped_column(M, default=0)
    discount_amount: Mapped[Decimal] = mapped_column(M, default=0)
    taxable_amount: Mapped[Decimal] = mapped_column(M, default=0)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    gst_amount: Mapped[Decimal] = mapped_column(M, default=0)
    final_client_price: Mapped[Decimal] = mapped_column(M, default=0)
    internal_development_cost: Mapped[Decimal] = mapped_column(M, default=0)
    internal_expenses: Mapped[Decimal] = mapped_column(M, default=0)
    contingency_amount: Mapped[Decimal] = mapped_column(M, default=0)
    total_internal_cost: Mapped[Decimal] = mapped_column(M, default=0)
    estimated_profit: Mapped[Decimal] = mapped_column(M, default=0)
    profit_margin: Mapped[Decimal] = mapped_column(Numeric(7, 2), default=0)
    estimated_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    estimated_delivery_days: Mapped[int] = mapped_column(Integer, default=0)
    timeline_override_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Snapshots: pricing options, developer allocation (with rate snapshot) and the full calculation result.
    adjustments: Mapped[dict] = mapped_column(JSON, default=dict)
    dev_allocation: Mapped[list] = mapped_column(JSON, default=list)
    calc_details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    client = relationship("Client")
    items = relationship("EstimateItem", cascade="all, delete-orphan", order_by="EstimateItem.id")
    expenses = relationship("Expense", cascade="all, delete-orphan", order_by="Expense.id")
    milestones = relationship(
        "PaymentMilestone", cascade="all, delete-orphan", order_by="PaymentMilestone.sequence_number"
    )
    quotations = relationship("Quotation", order_by="Quotation.id")

    @property
    def quotation_number(self) -> str | None:
        return self.quotations[-1].quotation_number if self.quotations else None
