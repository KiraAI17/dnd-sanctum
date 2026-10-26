from pydantic import BaseModel, Field


class RollRequest(BaseModel):
    formula: str = Field(
        ...,
        min_length=3,
        max_length=50,
        examples=["1d20+4", "4d6kh3", "1d20 adv"],
        description="Формула броска кубиков D&D 5e",
    )


class RollResponse(BaseModel):
    formula: str
    total: int
    breakdown: str
