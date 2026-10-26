from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.modifier import Modifier

item_modifiers = Table(
    "item_modifiers",
    Base.metadata,
    Column("item_id", Integer, ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("modifier_id", Integer, ForeignKey("modifiers.id", ondelete="CASCADE"), primary_key=True),
)


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_attuned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_identified: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="If False, player cannot see item modifiers or true description",
    )

    modifiers: Mapped[list["Modifier"]] = relationship(
        "Modifier",
        secondary=item_modifiers,
        lazy="selectin",
    )
