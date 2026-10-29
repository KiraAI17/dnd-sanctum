from urllib.parse import unquote
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from fastapi import APIRouter, HTTPException, Depends, status
import time
import shutil
from pathlib import Path
from fastapi import UploadFile, File

from app.dependencies import CurrentUser, DbSession
from app.models import Character, CharacterInventory, Item, UserRole
from app.models.character import generate_default_spell_slots, default_stats
from app.schemas.character import (
    VisualThemeUpdateSchema,
    CharacterCreate,
    CharacterDetailResponse,
    CharacterShortResponse,
    SpellSchema,
    SlotUpdateSchema,
    RestRequestSchema,
    LevelUpRequest,
    BackstoryUpdateSchema,
    EquipmentAddSchema,
)
from app.schemas.dice import RollRequest, RollResponse
from app.services.dice import roll_dice
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, HTTPException, status
from app.models.character import Character  # или откуда импортируется Character
from app.dependencies import DbSession, CurrentUser  # укажи актуальный путь к файлу с типами

router = APIRouter(prefix="/characters", tags=["Characters"])


class CharacterHPUpdate(BaseModel):
    hp_current: int | None = Field(default=None, ge=0, description="Текущее здоровье")
    hp_temp: int | None = Field(default=None, ge=0, description="Временные хиты")


def _verify_character_access(character: Character, user: CurrentUser) -> None:
    # Просмотр доступен владельцу, любому DM и для НИПов
    if character.user_id == user.id:
        return
    user_role_str = str(getattr(user, "role", "")).upper()
    if "DM" in user_role_str or getattr(user, "is_dm", False):
        return
    if getattr(character, "is_npc", False):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="У вас нет доступа к этому персонажу.")


def _verify_character_owner(character: Character, user: CurrentUser) -> None:
    # Редактировать кастомизацию, квенту и повышать уровень может ТОЛЬКО владелец
    if character.user_id == user.id:
        return
    # Мастер может редактировать только если персонаж помечен как NPC
    user_role_str = str(getattr(user, "role", "")).upper()
    is_dm = "DM" in user_role_str or getattr(user, "is_dm", False)
    if is_dm and getattr(character, "is_npc", False):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Только владелец персонажа может изменять эти данные!"
    )


@router.post(
    "/",
    response_model=CharacterShortResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать нового персонажа",
)
async def create_character(
        payload: CharacterCreate,
        db: DbSession,
        current_user: CurrentUser,
) -> CharacterShortResponse:
    character_data = payload.model_dump(exclude_unset=True)
    if "spell_slots" not in character_data or not character_data["spell_slots"]:
        character_data["spell_slots"] = generate_default_spell_slots(
            character_data.get("class_name", "Волшебник"),
            character_data.get("level", 1)
        )
    valid_data = {k: v for k, v in character_data.items() if hasattr(Character, k)}
    character = Character(**valid_data, user_id=current_user.id)

    db.add(character)
    await db.commit()
    await db.refresh(character)

    return CharacterShortResponse.model_validate(character)


@router.get(
    "/",
    response_model=list[CharacterShortResponse],
    summary="Получить список персонажей",
)
async def list_characters(
        db: DbSession,
        current_user: CurrentUser,
) -> list[CharacterShortResponse]:
    stmt = select(Character).order_by(Character.id)

    # Безопасная проверка роли (поддерживает и Enum, и строки вроде "DM")
    user_role_str = str(getattr(current_user, "role", "")).upper()
    is_dm = "DM" in user_role_str or getattr(current_user, "is_dm", False)

    if not is_dm:
        stmt = stmt.where(Character.user_id == current_user.id, Character.is_npc == False)

    result = await db.execute(stmt)
    characters = result.scalars().all()
    return [CharacterShortResponse.model_validate(char) for char in characters]


@router.get(
    "/{character_id}",
    response_model=CharacterDetailResponse,
    summary="Получить детальную информацию о персонаже",
)
async def get_character(
        character_id: int,
        db: DbSession,
        current_user: CurrentUser,
) -> CharacterDetailResponse:
    stmt = (
        select(Character)
        .where(Character.id == character_id)
        .options(
            selectinload(Character.inventory)
            .selectinload(CharacterInventory.item)
            .selectinload(Item.modifiers),
            selectinload(Character.active_modifiers),
        )
    )
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()

    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Персонаж с ID {character_id} не найден.",
        )

    _verify_character_access(character, current_user)

    if not character.spell_slots:
        character.spell_slots = generate_default_spell_slots(character.class_name, character.level)
        flag_modified(character, "spell_slots")
        await db.commit()

    return CharacterDetailResponse.for_viewer(character, current_user.role)


@router.patch(
    "/{character_id}/hp",
    response_model=CharacterShortResponse,
    summary="Быстрое обновление здоровья (HP) персонажа в бою",
)
async def update_character_hp(
        character_id: int,
        payload: CharacterHPUpdate,
        db: DbSession,
        current_user: CurrentUser,
) -> CharacterShortResponse:
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()

    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Персонаж с ID {character_id} не найден.",
        )

    _verify_character_access(character, current_user)

    if payload.hp_current is not None:
        max_hp = getattr(character, "hp_max", None)
        if max_hp is not None and payload.hp_current > max_hp:
            character.hp_current = max_hp
        else:
            character.hp_current = payload.hp_current

    if payload.hp_temp is not None:
        character.hp_temp = payload.hp_temp

    await db.commit()
    await db.refresh(character)
    return CharacterShortResponse.model_validate(character)


@router.post(
    "/{character_id}/roll",
    response_model=RollResponse,
    summary="Выполнить бросок дайсов от лица персонажа",
)
async def roll_for_character(
        character_id: int,
        payload: RollRequest,
        db: DbSession,
        current_user: CurrentUser,
) -> RollResponse:
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()

    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Персонаж с ID {character_id} не найден.",
        )

    _verify_character_access(character, current_user)

    try:
        dice_result = roll_dice(payload.formula)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return RollResponse(
        formula=payload.formula,
        total=dice_result.total,
        breakdown=dice_result.breakdown,
    )


@router.post("/{character_id}/spells", summary="Добавить заклинание в книгу")
async def add_spell(
        character_id: int,
        spell: SpellSchema,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Персонаж не найден")
    _verify_character_access(character, current_user)

    current_spells = list(character.spells or [])
    if any(s.get("name", "").strip().lower() == spell.name.strip().lower() for s in current_spells):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заклинание «{spell.name}» уже записано в книгу."
        )

    spell_data = spell.model_dump()
    if spell_data["level"] == 0:
        spell_data["is_cantrip"] = True
        spell_data["is_prepared"] = True
    else:
        spell_data["is_cantrip"] = False

    current_spells.append(spell_data)
    character.spells = current_spells
    flag_modified(character, "spells")
    await db.commit()
    return {"status": "ok", "spells": character.spells}


@router.delete("/{character_id}/spells/{spell_name}", summary="Удалить заклинание из книги")
async def delete_spell(
        character_id: int,
        spell_name: str,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Персонаж не найден")
    _verify_character_owner(character, current_user)

    decoded_name = unquote(spell_name).strip().lower()
    current_spells = list(character.spells or [])
    filtered = [s for s in current_spells if s.get("name", "").strip().lower() != decoded_name]

    character.spells = filtered
    flag_modified(character, "spells")
    await db.commit()
    return {"status": "ok", "spells": character.spells}


@router.patch("/{character_id}/spells/{spell_name}/prepare", summary="Подготовить/снять заклинание")
async def toggle_prepare_spell(
        character_id: int,
        spell_name: str,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Персонаж не найден")
    _verify_character_access(character, current_user)

    decoded_name = unquote(spell_name).strip().lower()
    current_spells = list(character.spells or [])
    found = False
    for s in current_spells:
        if s.get("name", "").strip().lower() == decoded_name:
            if s.get("level", 0) == 0:
                s["is_prepared"] = True
            else:
                s["is_prepared"] = not bool(s.get("is_prepared", False))
            found = True
            break

    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заклинание не найдено")

    character.spells = current_spells
    flag_modified(character, "spells")
    await db.commit()
    return {"status": "ok", "spells": character.spells}


@router.patch("/{character_id}/slots", summary="Обновить использованные ячейки заклинаний")
async def update_spell_slots(
        character_id: int,
        payload: SlotUpdateSchema,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Персонаж не найден")
    _verify_character_owner(character, current_user)

    slots = dict(character.spell_slots or generate_default_spell_slots(character.class_name, character.level))
    lvl_key = str(payload.level)
    if lvl_key in slots:
        max_val = slots[lvl_key].get("max", 0)
        slots[lvl_key]["used"] = max(0, min(payload.used, max_val))
        character.spell_slots = slots
        flag_modified(character, "spell_slots")
        await db.commit()

    return {"status": "ok", "spell_slots": character.spell_slots}


@router.post("/{character_id}/rest", summary="Совершить короткий или длинный отдых")
async def rest_character(
        character_id: int,
        payload: RestRequestSchema,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Персонаж не найден")
    _verify_character_access(character, current_user)

    if payload.rest_type == "long":
        character.hp_current = character.hp_max
        character.hp_temp = 0
        slots = dict(character.spell_slots or generate_default_spell_slots(character.class_name, character.level))
        for k in slots:
            slots[k]["used"] = 0
        character.spell_slots = slots
        flag_modified(character, "spell_slots")
        await db.commit()

    return {
        "status": "ok",
        "hp_current": character.hp_current,
        "spell_slots": character.spell_slots
    }


@router.delete("/{char_id}", summary="Удалить персонажа или НИПа")
async def delete_character(
        char_id: int,
        db: DbSession,
        current_user: CurrentUser
):
    char = await db.get(Character, char_id)
    if not char:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Персонаж не найден"
        )

    # Удалять может ИСКЛЮЧИТЕЛЬНО создатель / владелец
    if char.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не можете удалить чужого персонажа. Удаление разрешено только владельцу."
        )

    await db.delete(char)
    await db.commit()
    return {"status": "ok", "message": "Персонаж успешно удалён"}


@router.post("/{character_id}/level-up", response_model=CharacterDetailResponse, summary="Повысить уровень персонажа")
async def level_up_character(
        character_id: int,
        payload: LevelUpRequest,
        db: DbSession,
        current_user: CurrentUser,
) -> CharacterDetailResponse:
    stmt = (
        select(Character)
        .where(Character.id == character_id)
        .options(
            selectinload(Character.inventory)
            .selectinload(CharacterInventory.item)
            .selectinload(Item.modifiers),
            selectinload(Character.active_modifiers),
        )
    )
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Персонаж не найден")
    _verify_character_owner(character, current_user)

    if character.level >= 20:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Достигнут максимальный 20 уровень!")

    character.level += 1
    character.hp_max += payload.hp_increase
    character.hp_current += payload.hp_increase

    if payload.chosen_subclass:
        character.subclass = payload.chosen_subclass

    if payload.stat_increases:
        current_stats = dict(character.stats or default_stats())
        for k, inc in payload.stat_increases.items():
            if k in current_stats:
                current_stats[k] = min(30, current_stats[k] + inc)
        character.stats = current_stats
        flag_modified(character, "stats")

    if payload.new_feat:
        current_feats = list(character.feats or [])
        current_feats.append(payload.new_feat)
        character.feats = current_feats
        flag_modified(character, "feats")

    character.spell_slots = generate_default_spell_slots(character.class_name, character.level)
    flag_modified(character, "spell_slots")

    await db.commit()
    await db.refresh(character)
    return CharacterDetailResponse.for_viewer(character, current_user.role)


@router.patch("/{character_id}/backstory", summary="Сохранить квенту и биографию")
async def update_character_backstory(
        character_id: int,
        payload: BackstoryUpdateSchema,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    _verify_character_owner(character, current_user)

    character.backstory = payload.backstory
    await db.commit()
    return {"status": "ok", "backstory": character.backstory}


@router.post("/{character_id}/equipment", summary="Добавить предмет в инвентарь")
async def add_character_equipment(
        character_id: int,
        payload: EquipmentAddSchema,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    _verify_character_access(character, current_user)

    eq = list(character.starting_equipment or [])
    eq.append(payload.item_name.strip())
    character.starting_equipment = eq
    flag_modified(character, "starting_equipment")
    await db.commit()
    return {"status": "ok", "starting_equipment": character.starting_equipment}


@router.delete("/{character_id}/equipment/{item_idx}", summary="Удалить предмет из инвентаря")
async def delete_character_equipment(
        character_id: int,
        item_idx: int,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    _verify_character_owner(character, current_user)

    eq = list(character.starting_equipment or [])
    if 0 <= item_idx < len(eq):
        eq.pop(item_idx)
        character.starting_equipment = eq
        flag_modified(character, "starting_equipment")
        await db.commit()
    return {"status": "ok", "starting_equipment": character.starting_equipment}


@router.patch("/{character_id}/visual", summary="Обновить аватар, имя и цветовую тему персонажа")
async def update_character_visual(
        character_id: int,
        payload: VisualThemeUpdateSchema,
        db: DbSession,
        current_user: CurrentUser,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    _verify_character_owner(character, current_user)

    # 1. Обновляем имя, если передано
    if payload.name and payload.name.strip():
        character.name = payload.name.strip()

    # 2. Обновляем аватарку и баннер, НЕ затирая уже загруженные файлы пустыми строками
    if payload.avatar_url is not None:
        val = payload.avatar_url.strip()
        if val:
            character.avatar_url = val
        # Если пришла явно пустая строка, но ранее был загружен локальный файл — оставляем существующий
        # (затираем только если передано специальное значение вроде "clear" или "null")

    if payload.banner_url is not None:
        val = payload.banner_url.strip()
        if val:
            character.banner_url = val

    character.visual_theme = payload.visual_theme or "ember"
    character.visual_custom = payload.visual_custom or {}
    flag_modified(character, "visual_custom")

    await db.commit()
    await db.refresh(character)

    return {
        "status": "ok",
        "name": character.name,
        "avatar_url": character.avatar_url,
        "banner_url": character.banner_url,
        "visual_theme": character.visual_theme,
        "visual_custom": character.visual_custom
    }


class DMRaceUpdateSchema(BaseModel):
    race: str = Field(..., min_length=1, max_length=100)
    speed: int | None = None
    stat_bonuses: dict[str, int] | None = None


@router.patch("/{character_id}/race", summary="DM: Изменить расу персонажа и начислить бонусы")
async def update_character_race_dm(
        character_id: int,
        payload: DMRaceUpdateSchema,
        db: DbSession,
        current_user: CurrentUser,
):
    if current_user.role != UserRole.DM:
        raise HTTPException(status_code=403, detail="Только Мастер (DM) может менять расу персонажа!")

    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    character.race = payload.race.strip()
    if payload.speed:
        character.speed = payload.speed

    if payload.stat_bonuses:
        cur_stats = dict(character.stats or {'str': 10, 'dex': 10, 'con': 10, 'int': 10, 'wis': 10, 'cha': 10})
        for k, v in payload.stat_bonuses.items():
            if k in cur_stats:
                cur_stats[k] = min(30, cur_stats[k] + v)
        character.stats = cur_stats
        flag_modified(character, "stats")

    await db.commit()
    await db.refresh(character)
    return CharacterDetailResponse.for_viewer(character, current_user.role)


UPLOAD_AVATAR_DIR = Path(__file__).resolve().parent.parent / "static" / "avatars"
UPLOAD_BANNER_DIR = Path(__file__).resolve().parent.parent / "static" / "banners"

UPLOAD_AVATAR_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_BANNER_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/{character_id}/avatar/upload", summary="Загрузить аватарку персонажа файлом")
async def upload_character_avatar(
    character_id: int,
    file: UploadFile = File(...),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    _verify_character_owner(character, current_user)

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ('.png', '.jpg', '.jpeg', '.webp', '.gif'):
        raise HTTPException(status_code=400, detail="Поддерживаются только изображения (.png, .jpg, .webp, .gif)")

    clean_filename = f"char_{character_id}_avatar_{int(time.time())}{suffix}"
    dest_path = UPLOAD_AVATAR_DIR / clean_filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/static/avatars/{clean_filename}"
    character.avatar_url = file_url
    await db.commit()
    await db.refresh(character)

    return {"status": "ok", "avatar_url": file_url}


@router.post("/{character_id}/banner/upload", summary="Загрузить обложку (баннер) персонажа файлом")
async def upload_character_banner(
    character_id: int,
    file: UploadFile = File(...),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    _verify_character_owner(character, current_user)

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ('.png', '.jpg', '.jpeg', '.webp', '.gif'):
        raise HTTPException(status_code=400, detail="Поддерживаются только изображения (.png, .jpg, .webp, .gif)")

    clean_filename = f"char_{character_id}_banner_{int(time.time())}{suffix}"
    dest_path = UPLOAD_BANNER_DIR / clean_filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/static/banners/{clean_filename}"
    character.banner_url = file_url
    await db.commit()
    await db.refresh(character)

    return {"status": "ok", "banner_url": file_url}