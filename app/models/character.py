# app/models/character
from datetime import datetime
from typing import TYPE_CHECKING, Any
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.item import Item
from app.models.modifier import Modifier

if TYPE_CHECKING:
    from app.models.user import User

StatsDict = dict[str, int]
SpellSlotsDict = dict[str, dict[str, int]]
SpellList = list[dict[str, Any]]

character_modifiers = Table(
    "character_modifiers",
    Base.metadata,
    Column("character_id", Integer, ForeignKey("characters.id", ondelete="CASCADE"), primary_key=True),
    Column("modifier_id", Integer, ForeignKey("modifiers.id", ondelete="CASCADE"), primary_key=True),
)


class CharacterInventory(Base):
    __tablename__ = "character_inventory"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    equipped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    character: Mapped["Character"] = relationship("Character", back_populates="inventory")
    item: Mapped["Item"] = relationship("Item", lazy="selectin")


def default_stats() -> StatsDict:
    return {"str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10}


def generate_default_spell_slots(class_name: str, level: int) -> SpellSlotsDict:
    c = (class_name or "").lower()
    full_casters = ["волшебник", "wizard", "жрец", "cleric", "друид", "druid", "бард", "bard", "чародей", "sorcerer"]
    artificers = ["изобретатель", "artificer"]
    half_casters = ["паладин", "paladin", "следопыт", "ranger"]

    full_table = {
        1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2],
        6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
        10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1],
        13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1], 15: [4, 3, 3, 3, 2, 1, 1, 1],
        16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
    }
    artificer_table = {
        1: [2], 2: [2], 3: [3], 4: [3], 5: [4, 2],
        6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2],
        10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1],
        14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1],
        18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2]
    }
    half_table = {
        1: [], 2: [2], 3: [3], 4: [3], 5: [4, 2],
        6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2],
        10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1],
        14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1],
        18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2]
    }

    lvl = max(1, min(level, 20))
    if any(k in c for k in full_casters):
        row = full_table.get(lvl, [])
    elif any(k in c for k in artificers):
        row = artificer_table.get(lvl, [])
    elif any(k in c for k in half_casters):
        row = half_table.get(lvl, [])
    else:
        row = []

    slots = {}
    for spell_lvl in range(1, 10):
        idx = spell_lvl - 1
        max_slots = row[idx] if idx < len(row) else 0
        if max_slots > 0:
            slots[str(spell_lvl)] = {"max": max_slots, "used": 0}
    return slots


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    class_name: Mapped[str] = mapped_column(String(50), nullable=False)
    subclass: Mapped[str] = mapped_column(String(100), nullable=True, default=None)
    avatar_url: Mapped[str] = mapped_column(String(1000), nullable=True, default=None)
    visual_theme: Mapped[str] = mapped_column(String(50), nullable=False, default="ember")
    banner_url: Mapped[str] = mapped_column(String(1000), nullable=True, default=None)
    visual_custom: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    race: Mapped[str] = mapped_column(String(50), nullable=False)
    is_npc: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    hp_current: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    hp_max: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    hp_temp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    armor_class: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    speed: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    stats: Mapped[StatsDict] = mapped_column(JSON, default=default_stats, nullable=False)
    spell_slots: Mapped[SpellSlotsDict] = mapped_column(JSON, default=dict, nullable=False)
    spells: Mapped[SpellList] = mapped_column(JSON, default=list, nullable=False)
    feats: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    alignment: Mapped[str] = mapped_column(String(50), default="Истинно нейтральный", nullable=True)
    background: Mapped[str] = mapped_column(String(100), default="Народный герой", nullable=True)
    backstory: Mapped[str] = mapped_column(String(2000), default="", nullable=True)
    starting_equipment: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="characters")
    inventory: Mapped[list["CharacterInventory"]] = relationship(
        "CharacterInventory",
        back_populates="character",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    active_modifiers: Mapped[list["Modifier"]] = relationship(
        "Modifier",
        secondary=character_modifiers,
        lazy="selectin",
    )

    @property
    def effective_race(self) -> str:
        """Возвращает публичную расу с учётом маскировки Чейнджлинга."""
        if not self.race:
            return "Неизвестно"
        if "чейнджлинг" in self.race.lower():
            custom = self.visual_custom or {}
            if isinstance(custom, str):
                import json
                try:
                    custom = json.loads(custom)
                except Exception:
                    custom = {}
            if isinstance(custom, dict) and custom.get("disguise_active"):
                return custom.get("disguise_race") or self.race
        return self.race
