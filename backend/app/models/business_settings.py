from decimal import Decimal

from sqlalchemy import JSON, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class BusinessSettings(Base):
    __tablename__ = "business_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    business_name: Mapped[str] = mapped_column(String(200), default="Logic Loops")
    tagline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    brand_color: Mapped[str | None] = mapped_column(String(30), nullable=True, default="#111827")
    upi_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_currency: Mapped[str] = mapped_column(String(3), default="INR")
    default_gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18)
    default_gst_enabled: Mapped[bool] = mapped_column(default=False)
    default_profit_margin: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=30)
    default_contingency: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=10)
    quotation_prefix: Mapped[str] = mapped_column(String(20), default="QT")
    quotation_validity_days: Mapped[int] = mapped_column(Integer, default=15)
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    revision_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # revision_limit, hours_per_day, default milestones, maintenance prices
    extra_defaults: Mapped[dict] = mapped_column(JSON, default=dict)
