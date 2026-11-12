from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.estimate import StatusIn  # noqa: F401  (re-exported)


class QuotationCreate(BaseModel):
    estimate_id: int
    issue_date: date | None = None
    validity_days: int | None = Field(None, ge=1, le=365)


class QuotationUpdate(BaseModel):
    issue_date: date | None = None
    expiry_date: date | None = None

    @model_validator(mode="after")
    def _order(self):
        if self.issue_date and self.expiry_date and self.expiry_date < self.issue_date:
            raise ValueError("expiry_date cannot be before issue_date")
        return self


class QuotationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    estimate_id: int
    quotation_number: str
    status: str
    issue_date: date
    expiry_date: date
    generated_at: datetime | None = None
