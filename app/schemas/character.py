from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.character import default_stats
from app.models.modifier import ModifierType
from app.models.user import UserRole

REQUIRED_STATS = {"str", "dex", "con", "int", "wis", "cha"}


class ModifierResponse(BaseModel):
    id: int
    name: str
    target: str
    mod_type: ModifierType
    value: int
    is_hidden: bool

    model_config = ConfigDict(from_attributes=True)


class ItemResponse(BaseModel):
    id: int
    name: str
    description: str | None
    weight: float
    is_attuned: bool
    is_identified: bool
    modifiers: list[ModifierResponse] = []

    model_config = ConfigDict(from_attributes=True)


class InventoryEntryResponse(BaseModel):
    id: int
    quantity: int
    equipped: bool
    item: ItemResponse

    model_config = ConfigDict(from_attributes=True)


class SpellSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    level: int = Field(default=0, ge=0, le=9)
    school: str = Field(default="Воплощение")
    cast_time: str = Field(default="1 действие")
    range: str = Field(default="60 футов")
    components: str = Field(default="В, С")
    duration: str = Field(default="Мгновенная")
    description: str = Field(default="")
    is_prepared: bool = Field(default=False)
    is_cantrip: bool = Field(default=False)
    damage_dice: str | None = Field(default=None)


class SlotUpdateSchema(BaseModel):
    level: int = Field(..., ge=1, le=9)
    used: int = Field(..., ge=0)


class RestRequestSchema(BaseModel):
    rest_type: Literal["short", "long"]


class BackstoryUpdateSchema(BaseModel):
    backstory: str = Field(default="", max_length=5000)


class EquipmentAddSchema(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=150)




class VisualThemeUpdateSchema(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=1000)
    banner_url: str | None = Field(default=None, max_length=1000)
    visual_theme: str = Field(default="ember", max_length=50)
    visual_custom: dict[str, Any] = Field(default_factory=dict)

class LevelUpRequest(BaseModel):
    hp_increase: int = Field(..., ge=1, le=50)
    stat_increases: dict[str, int] | None = None
    new_feat: dict[str, Any] | None = None
    chosen_subclass: str | None = None


class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    class_name: str = Field(..., min_length=1, max_length=50)
    level: int = Field(default=1, ge=1, le=20)
    race: str = Field(..., min_length=1, max_length=50)
    is_npc: bool = Field(default=False)
    hp_current: int = Field(default=10, ge=0)
    hp_max: int = Field(default=10, ge=1)
    hp_temp: int = Field(default=0, ge=0)
    armor_class: int = Field(default=10, ge=1, le=50)
    speed: int = Field(default=30, ge=0)
    stats: dict[str, int] = Field(default_factory=default_stats)
    spell_slots: dict[str, dict[str, int]] = Field(default_factory=dict)
    spells: list[dict[str, Any]] = Field(default_factory=list)
    alignment: str | None = Field(default="Истинно нейтральный")
    background: str | None = Field(default="Народный герой")
    backstory: str | None = Field(default="")
    starting_equipment: list[str] = Field(default_factory=list)
    feats: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("stats")
    @classmethod
    def validate_dnd_stats(cls, v: dict[str, int]) -> dict[str, int]:
        if set(v.keys()) != REQUIRED_STATS:
            raise ValueError(f"Stats must contain exact keys: {REQUIRED_STATS}")
        for stat, val in v.items():
            if not (1 <= val <= 30):
                raise ValueError(f"Stat '{stat}' must be between 1 and 30 (D&D 5e rules)")
        return v

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CharacterShortResponse(BaseModel):
    id: int
    user_id: int
    name: str
    class_name: str
    level: int
    race: str
    true_race: str | None = None
    is_npc: bool = Field(default=False)
    hp_current: int
    hp_max: int
    armor_class: int
    stats: dict[str, int] = Field(default_factory=default_stats)
    created_at: datetime | None = None
    subclass: str | None = None
    avatar_url: str | None = None
    banner_url: str | None = None
    visual_theme: str = 'ember'
    visual_custom: dict[str, Any] = Field(default_factory=dict)
    alignment: str | None = None
    background: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def mask_changeling_disguise(self) -> "CharacterShortResponse":
        # Запоминаем настоящую расу
        self.true_race = self.race

        if "чейнджлинг" in (self.race or "").lower():
            vc = self.visual_custom or {}
            if isinstance(vc, str):
                import json
                try:
                    vc = json.loads(vc)
                except Exception:
                    vc = {}
            if isinstance(vc, dict) and vc.get("disguise_active") and vc.get("disguise_race"):
                self.race = vc["disguise_race"]
        return self

class CharacterDetailResponse(CharacterShortResponse):
    hp_temp: int
    speed: int
    spell_slots: dict[str, dict[str, int]]
    spells: list[dict[str, Any]] = []
    backstory: str | None = ""
    starting_equipment: list[str] = []
    feats: list[dict[str, Any]] = []
    inventory: list[InventoryEntryResponse] = []
    active_modifiers: list[ModifierResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def for_viewer(cls, character: Any, viewer_role: UserRole) -> "CharacterDetailResponse":
        dto = cls.model_validate(character)
        match viewer_role:
            case UserRole.DM:
                return dto
            case UserRole.PLAYER:
                dto.active_modifiers = [m for m in dto.active_modifiers if not m.is_hidden]
                for entry in dto.inventory:
                    if not entry.item.is_identified:
                        entry.item.description = "Свойства этого предмета еще не изучены (требуется Опознание)."
                        entry.item.modifiers = []
                    else:
                        entry.item.modifiers = [
                            m for m in entry.item.modifiers if not m.is_hidden
                        ]
                return dto
