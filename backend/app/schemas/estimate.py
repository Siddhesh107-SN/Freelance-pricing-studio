from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.client import ClientIn, ClientOut

Money = Field(Decimal("0"), ge=0, max_digits=14, decimal_places=2)
Pct = Field(Decimal("0"), ge=0, le=100, max_digits=7, decimal_places=2)


class ItemIn(BaseModel):
    feature_id: int | None = None
    name: str = ""
    description: str = ""
    quantity: int = Field(1, ge=1, le=1000)
    unit_price: Decimal = Money  # ignored for configured features; the backend uses the configured price
    estimated_hours: Decimal = Field(Decimal("0"), ge=0, max_digits=10, decimal_places=2)  # per unit
    assigned_team_member_id: int | None = None
    internal_cost: Decimal = Money  # per unit, custom features only

    @model_validator(mode="after")
    def _custom_needs_name(self):
        if self.feature_id is None and not self.name.strip():
            raise ValueError("Custom features need a name")
        return self


class DevLineIn(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    estimated_hours: Decimal = Field(Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    team_member_id: int | None = None
    completion_days: Decimal | None = Field(None, ge=0)


class ExpenseIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    category: str = Field("Other expenses", max_length=80)
    amount: Decimal = Money
    expense_type: Literal["one_time", "recurring", "yearly", "usage"] = "one_time"
    billing_type: Literal["client_billed", "absorbed"] = "client_billed"
    notes: str | None = None


class MilestoneIn(BaseModel):
    milestone_name: str = Field(min_length=1, max_length=160)
    percentage: Decimal = Field(gt=0, le=100, max_digits=5, decimal_places=2)


class MaintenanceIn(BaseModel):
    package: Literal["none", "basic", "standard", "premium"] = "none"
    billing: Literal["monthly", "annual", "custom"] = "monthly"
    custom_amount: Decimal | None = Field(None, ge=0)
    months: int = Field(12, ge=1, le=120)


class PricingIn(BaseModel):
    fixed_price: Decimal = Money
    hourly_rate: Decimal = Money
    custom_price: Decimal = Money
    margin_mode: Literal["margin", "markup", "none"] = "margin"
    profit_margin: Decimal = Field(Decimal("30"), ge=0, lt=100)
    markup_pct: Decimal = Field(Decimal("0"), ge=0, le=1000)
    contingency_pct: Decimal = Pct
    contingency_in_client_price: bool = False
    discount_pct: Decimal = Pct
    additional_charges: Decimal = Money
    minimum_price: Decimal = Money
    gst_enabled: bool = False
    gst_rate: Decimal = Field(Decimal("18"), ge=0, le=100)
    maintenance: MaintenanceIn = MaintenanceIn()


class EstimateIn(BaseModel):
    client_id: int | None = None
    client: ClientIn | None = None
    project_name: str = Field(min_length=1, max_length=200)
    project_description: str = ""
    project_type: str = ""
    category_id: int | None = None
    complexity: Literal["basic", "intermediate", "advanced"] = "basic"
    pricing_method: Literal["fixed", "hourly", "feature", "custom"] = "feature"
    pricing: PricingIn = PricingIn()
    items: list[ItemIn] = []
    dev_allocation: list[DevLineIn] = []
    expenses: list[ExpenseIn] = []
    milestones: list[MilestoneIn] | None = None
    timeline_override_days: int | None = Field(None, ge=0, le=3650)

    @model_validator(mode="after")
    def _milestones_total(self):
        if self.milestones is not None and sum((m.percentage for m in self.milestones), Decimal(0)) != Decimal(100):
            raise ValueError("Milestone percentages must add up to 100")
        return self


class StatusIn(BaseModel):
    status: Literal["Draft", "Sent", "Accepted", "Rejected", "Expired"]


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    feature_id: int | None
    feature_name_snapshot: str
    description_snapshot: str | None
    quantity: int
    unit_price: Decimal
    estimated_hours: Decimal
    assigned_team_member_id: int | None
    internal_cost: Decimal
    total_price: Decimal


class ExpenseOut(ExpenseIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class MilestoneOut(MilestoneIn):
    model_config = ConfigDict(from_attributes=True)
    amount: Decimal
    sequence_number: int


class EstimateListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    estimate_number: str
    project_name: str
    client_name: str | None = None
    status: str
    final_client_price: Decimal
    quotation_number: str | None = None
    created_at: datetime
    updated_at: datetime


class EstimateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    estimate_number: str
    client_id: int | None
    client: ClientOut | None
    project_name: str
    project_description: str | None
    project_type: str | None
    category_id: int | None
    complexity: str
    pricing_method: str
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    gst_rate: Decimal
    gst_amount: Decimal
    final_client_price: Decimal
    internal_development_cost: Decimal
    internal_expenses: Decimal
    contingency_amount: Decimal
    total_internal_cost: Decimal
    estimated_profit: Decimal
    profit_margin: Decimal
    estimated_hours: Decimal
    estimated_delivery_days: int
    timeline_override_days: int | None
    adjustments: dict
    dev_allocation: list
    calc_details: dict
    quotation_number: str | None = None
    items: list[ItemOut]
    expenses: list[ExpenseOut]
    milestones: list[MilestoneOut]
    created_at: datetime
    updated_at: datetime
