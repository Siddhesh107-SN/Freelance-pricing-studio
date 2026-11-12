from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

Money = Field(Decimal("0"), ge=0, max_digits=14, decimal_places=2)


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    active: bool = True
    sort_order: int = 0


class CategoryOut(CategoryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class FeatureIn(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    basic_price: Decimal = Money
    intermediate_price: Decimal = Money
    advanced_price: Decimal = Money
    estimated_hours: Decimal = Field(Decimal("0"), ge=0, max_digits=8, decimal_places=2)
    default_internal_cost: Decimal = Money
    active: bool = True
    sort_order: int = 0


class FeatureOut(FeatureIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ReorderIn(BaseModel):
    ids: list[int]  # feature ids in the new order
