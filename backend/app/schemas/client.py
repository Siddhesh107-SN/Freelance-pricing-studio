from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ClientIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    company: str | None = Field(None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=40)
    whatsapp: str | None = Field(None, max_length=40)


class ClientOut(ClientIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
