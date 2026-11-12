from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SettingsIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=200)
    tagline: str | None = None
    brand_color: str | None = Field("#111827", max_length=30)
    upi_id: str | None = None
    gstin: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    whatsapp: str | None = None
    address: str | None = None
    website: str | None = None
    default_currency: str = Field("INR", min_length=3, max_length=3)
    default_gst_rate: Decimal = Field(Decimal("18"), ge=0, le=100)
    default_gst_enabled: bool = False
    default_profit_margin: Decimal = Field(Decimal("30"), ge=0, lt=100)
    default_contingency: Decimal = Field(Decimal("10"), ge=0, le=100)
    quotation_prefix: str = Field("QT", min_length=1, max_length=20)
    quotation_validity_days: int = Field(15, ge=1, le=365)
    payment_terms: str | None = None
    revision_policy: str | None = None
    terms_and_conditions: str | None = None
    extra_defaults: dict = Field(default_factory=dict)


class SettingsOut(SettingsIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    logo_path: str | None = None
    email: str | None = None


class TeamMemberIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    internal_hourly_rate: Decimal = Field(Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    active: bool = True


class TeamMemberOut(TeamMemberIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
