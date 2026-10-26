from enum import StrEnum

from sqlalchemy import Boolean, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ModifierType(StrEnum):
    FLAT_BONUS = "flat_bonus"
    ADVANTAGE = "advantage"
    DISADVANTAGE = "disadvantage"


class Modifier(Base):
    __tablename__ = "modifiers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="e.g., 'str', 'ac', 'perception', 'stealth', 'saving_throws'",
    )
    mod_type: Mapped[ModifierType] = mapped_column(
        Enum(ModifierType),
        default=ModifierType.FLAT_BONUS,
        nullable=False,
    )
    value: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="True if only DM can see this effect/curse",
    )
