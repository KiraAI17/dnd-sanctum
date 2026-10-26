import random
import re
from dataclasses import dataclass

DICE_REGEX = re.compile(
    r"^\s*"
    r"(?P<count>\d+)d(?P<sides>\d+)"
    r"(?:(?P<keep_mode>kh|kl)(?P<keep_count>\d+))?"
    r"(?:\s*(?P<modifier>[+-]\s*\d+))?"
    r"(?:\s+(?P<adv_flag>adv|dis))?"
    r"\s*$",
    re.IGNORECASE,
)


@dataclass(slots=True, frozen=True)
class DiceResult:
    total: int
    rolls: list[int]
    kept_rolls: list[int]
    dropped_rolls: list[int]
    modifier: int
    breakdown: str


def roll_dice(formula: str) -> DiceResult:
    """
    Парсит формулу броска кубиков D&D 5e и возвращает детализированный результат.
    Поддерживает: '1d20+5', '4d6kh3', '2d20kl1', '1d20 adv', '1d20+3 dis'.
    """
    match = DICE_REGEX.match(formula)
    if not match:
        raise ValueError(
            f"Некорректный формат формулы: '{formula}'. "
            "Примеры: '1d20+5', '4d6kh3', '1d20 adv'."
        )

    count = int(match.group("count"))
    sides = int(match.group("sides"))
    keep_mode = match.group("keep_mode")
    keep_count_str = match.group("keep_count")
    mod_str = match.group("modifier")
    adv_flag = match.group("adv_flag")

    if count < 1 or count > 100:
        raise ValueError("Количество кубиков должно быть от 1 до 100.")
    if sides < 2 or sides > 1000:
        raise ValueError("Количество граней должно быть от 2 до 1000.")

    # Обработка флагов преимущества/помехи (adv / dis)
    if adv_flag:
        if keep_mode is not None:
            raise ValueError("Нельзя одновременно использовать kh/kl и флаги adv/dis.")
        if count != 1:
            raise ValueError("Флаги adv/dis применимы только к броску 1 кубика (например, '1d20 adv').")
        count = 2
        keep_mode = "kh" if adv_flag.lower() == "adv" else "kl"
        keep_count = 1
    elif keep_mode and keep_count_str:
        keep_mode = keep_mode.lower()
        keep_count = int(keep_count_str)
        if keep_count < 1 or keep_count > count:
            raise ValueError(
                f"Количество оставляемых кубиков ({keep_count}) должно быть от 1 до {count}."
            )
    else:
        keep_count = count

    modifier = int(mod_str.replace(" ", "")) if mod_str else 0

    # Генерация бросков
    rolls = [random.randint(1, sides) for _ in range(count)]

    # Определение удержанных и отброшенных значений с сохранением порядка броска
    if keep_mode:
        indexed_rolls = list(enumerate(rolls))
        reverse_sort = keep_mode == "kh"
        sorted_by_val = sorted(indexed_rolls, key=lambda x: x[1], reverse=reverse_sort)

        kept_indices = {idx for idx, _ in sorted_by_val[:keep_count]}
        kept_rolls = [val for idx, val in indexed_rolls if idx in kept_indices]
        dropped_rolls = [val for idx, val in indexed_rolls if idx not in kept_indices]

        rolls_formatted = [
            str(val) if idx in kept_indices else f"({val})"
            for idx, val in indexed_rolls
        ]
    else:
        kept_rolls = list(rolls)
        dropped_rolls = []
        rolls_formatted = [str(val) for val in rolls]

    total = sum(kept_rolls) + modifier

    # Сборка наглядной строки (breakdown)
    rolls_part = f"[{', '.join(rolls_formatted)}]"
    if modifier > 0:
        mod_part = f" + {modifier}"
    elif modifier < 0:
        mod_part = f" - {abs(modifier)}"
    else:
        mod_part = ""

    breakdown = f"{rolls_part}{mod_part} = {total}"

    return DiceResult(
        total=total,
        rolls=rolls,
        kept_rolls=kept_rolls,
        dropped_rolls=dropped_rolls,
        modifier=modifier,
        breakdown=breakdown,
    )
