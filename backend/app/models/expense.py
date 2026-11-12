from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Expense(Base):
    __tablename__ = "expenses"
    id: Mapped[int] = mapped_column(primary_key=True)
    estimate_id: Mapped[int] = mapped_column(ForeignKey("estimates.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(80))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    expense_type: Mapped[str] = mapped_column(String(20), default="one_time")  # one_time | recurring
    billing_type: Mapped[str] = mapped_column(String(20), default="client_billed")  # client_billed | absorbed
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
