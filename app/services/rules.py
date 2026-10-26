from typing import Any
from app.models import Character, Modifier, ModifierType

STAT_KEYS: tuple[str, ...] = ("str", "dex", "con", "int", "wis", "cha")

# Поддержка возможных вариантов именования полей в модели Character/Modifier
STAT_ALIASES: dict[str, str] = {
    "str": "str",
    "strength": "str",
    "dex": "dex",
    "dexterity": "dex",
    "con": "con",
    "constitution": "con",
    "int": "int",
    "intelligence": "int",
    "wis": "wis",
    "wisdom": "wis",
    "cha": "cha",
    "charisma": "cha",
}


def calculate_proficiency_bonus(level: int) -> int:
    """Вычисляет бонус мастерства по уровню персонажа (1-20)."""
    if level < 1:
        raise ValueError("Уровень персонажа не может быть меньше 1.")
    return (level - 1) // 4 + 2


def get_stat_modifier(score: int) -> int:
    """Вычисляет модификатор характеристики D&D 5e."""
    return (score - 10) // 2


def _extract_base_stats(character: Character) -> dict[str, int]:
    """Извлекает базовые характеристики из модели персонажа."""
    if hasattr(character, "stats") and isinstance(character.stats, dict):
        return {k: int(character.stats.get(k, 10)) for k in STAT_KEYS}

    base_stats: dict[str, int] = {}
    full_names = {
        "str": "strength",
        "dex": "dexterity",
        "con": "constitution",
        "int": "intelligence",
        "wis": "wisdom",
        "cha": "charisma",
    }
    for short_key, full_key in full_names.items():
        if hasattr(character, short_key):
            base_stats[short_key] = int(getattr(character, short_key))
        elif hasattr(character, f"base_{short_key}"):
            base_stats[short_key] = int(getattr(character, f"base_{short_key}"))
        elif hasattr(character, full_key):
            base_stats[short_key] = int(getattr(character, full_key))
        else:
            base_stats[short_key] = 10

    return base_stats


def _resolve_modifier_target(modifier: Modifier) -> str | None:
    """Определяет целевую характеристику модификатора (str, dex, con, int, wis, cha)."""
    for attr in ("stat", "target_stat", "target", "attribute", "ability"):
        raw_val: Any = getattr(modifier, attr, None)
        if raw_val is not None:
            val_str = str(getattr(raw_val, "value", raw_val)).lower()
            if val_str in STAT_ALIASES:
                return STAT_ALIASES[val_str]
    return None


def _apply_flat_modifiers(stats: dict[str, int], modifiers: list[Modifier]) -> None:
    """Применяет плоские бонусы (FLAT_BONUS) к словарю характеристик."""
    for mod in modifiers:
        mod_type = getattr(mod, "modifier_type", getattr(mod, "type", None))
        if mod_type == ModifierType.FLAT_BONUS:
            target = _resolve_modifier_target(mod)
            if target in stats:
                value = int(getattr(mod, "value", getattr(mod, "bonus", 0)))
                stats[target] += value


def calculate_effective_stats(character: Character) -> dict[str, int]:
    """
    Рассчитывает итоговые характеристики персонажа:
    Базовые характеристики + active_modifiers + модификаторы экипированных предметов.
    """
    effective_stats = _extract_base_stats(character)

    # 1. Активные модификаторы персонажа
    if character.active_modifiers:
        _apply_flat_modifiers(effective_stats, list(character.active_modifiers))

    # 2. Модификаторы от экипированных предметов в инвентаре
    if character.inventory:
        for inv_entry in character.inventory:
            is_equipped = getattr(inv_entry, "equipped", getattr(inv_entry, "is_equipped", False))
            if is_equipped and inv_entry.item and inv_entry.item.modifiers:
                _apply_flat_modifiers(effective_stats, list(inv_entry.item.modifiers))

    return effective_stats
