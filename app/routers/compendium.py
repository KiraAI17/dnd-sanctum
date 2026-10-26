import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

# Импортируем зависимость текущего пользователя (как в routers/parties.py или characters.py)
from app.dependencies import CurrentUser  # или get_current_user в зависимости от твоего проекта

router = APIRouter(prefix="/compendium", tags=["compendium"])
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class TraitSchema(BaseModel):
    name: str
    description: str


class RaceCreateSchema(BaseModel):
    name: str
    description: str
    speed: int = 30
    ability_bonuses: Dict[str, int] = {}
    traits: List[TraitSchema] = []
    dm_only: bool = False


def get_all_races_raw() -> List[Dict[str, Any]]:
    f = DATA_DIR / "races.json"
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_all_races(races_list: List[Dict[str, Any]]) -> None:
    f = DATA_DIR / "races.json"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(races_list, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("/races", summary="Список рас компендиума с изоляцией по автору")
async def get_compendium_races(
        is_dm: str = "false",
        current_user: CurrentUser = None
):
    races = get_all_races_raw()
    is_dm_mode = str(is_dm).lower() in ("true", "1", "yes")

    current_user_id = getattr(current_user, "id", None) if current_user else None

    visible_races = []
    for r in races:
        # Если раса помечена только для DM, а запрос не от DM — пропускаем
        if r.get("dm_only", False) and not is_dm_mode:
            continue

        # Базовые системные расы видны всем
        is_custom = r.get("is_custom", False)
        creator_id = r.get("creator_id")

        if not is_custom or creator_id is None:
            visible_races.append(r)
            continue

        # Авторские расы показываем ТОЛЬКО тому пользователю, который их создал
        if current_user_id is not None and creator_id == current_user_id:
            visible_races.append(r)

    return visible_races


@router.post("/races", summary="Создание авторской расы (привязка к текущему аккаунту)")
async def create_custom_race(
        payload: RaceCreateSchema,
        current_user: CurrentUser
):
    races = get_all_races_raw()
    race_id = "custom_" + payload.name.lower().replace(" ", "_")

    # Проверка на дубликат среди рас этого же автора или базовых
    for r in races:
        if r.get("name", "").lower() == payload.name.lower():
            # Если имя совпадает с базовой или своей расой — запрещаем
            if not r.get("is_custom", False) or r.get("creator_id") == current_user.id:
                raise HTTPException(status_code=400, detail="Раса с таким именем уже существует!")

    new_race = {
        "id": race_id,
        "name": payload.name,
        "description": payload.description,
        "speed": payload.speed,
        "ability_bonuses": payload.ability_bonuses,
        "traits": [t.dict() for t in payload.traits],
        "dm_only": payload.dm_only,
        "is_custom": True,
        # Жесткая привязка к автору
        "creator_id": current_user.id,
        "creator_username": getattr(current_user, "username", "Unknown")
    }
    races.append(new_race)
    save_all_races(races)
    return new_race


@router.delete("/races/{race_id}", summary="Удаление расы (только автором)")
async def delete_custom_race(
        race_id: str,
        current_user: CurrentUser
):
    races = get_all_races_raw()
    race_to_delete = next((r for r in races if r.get("id") == race_id), None)

    if not race_to_delete:
        raise HTTPException(status_code=404, detail="Раса не найдена")

    # Проверяем, что удаляет именно создатель расы
    if race_to_delete.get("is_custom") and race_to_delete.get("creator_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете удалять только свои авторские расы!")

    races = [r for r in races if r.get("id") != race_id]
    save_all_races(races)
    return {"status": "success", "deleted_id": race_id}


@router.get("/classes", summary="Список классов")
async def get_compendium_classes():
    f = DATA_DIR / "classes.json"
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return []


@router.get("/backgrounds", summary="Список предысторий")
async def get_compendium_backgrounds():
    f = DATA_DIR / "backgrounds.json"
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return []


@router.get("/feats", summary="Справочник черт")
async def get_compendium_feats():
    f = DATA_DIR / "feats.json"
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return []


@router.get("/spells", summary="Список заклинаний")
async def get_compendium_spells():
    f = DATA_DIR / "spells.json"
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return []


@router.get("/blood-curses", summary="Справочник проклятий крови")
async def get_compendium_blood_curses():
    f = DATA_DIR / "blood_curses.json"
    if not f.exists():
        return []
    return json.loads(f.read_text(encoding="utf-8"))


@router.get("/mutagens", summary="Справочник мутагенов")
async def get_compendium_mutagens():
    f = DATA_DIR / "mutagens.json"
    if not f.exists():
        return []
    return json.loads(f.read_text(encoding="utf-8"))


@router.get("/maneuvers", summary="Справочник приёмов воина")
async def get_compendium_maneuvers():
    f = DATA_DIR / "maneuvers.json"
    if not f.exists():
        return []
    return json.loads(f.read_text(encoding="utf-8"))