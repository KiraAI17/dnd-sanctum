#app_routers_parties
import datetime
import shutil
import json
import random
from pathlib import Path
from typing import Annotated, List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.core.security import get_password_hash, verify_password
from app.dependencies import CurrentUser, DbSession
from app.models.party import Party, PartyMember, PartyMessage
from app.models.character import Character
from app.models.user import User
from app.schemas.party import (
    PartyCreateSchema,
    PartyResponse,
    PartyDetailResponse,
    PartyMemberResponse,
    PartyJoinSchema,
    PartyJoinByNameSchema,
    AttachCharacterSchema,
    QuickNPCCreateSchema,
    CustomRaceCreateSchema,
    SendMessageSchema,
    RollStatSchema,
    MessageResponseSchema,
    UpdateSettingsSchema,
    NotesUpdateSchema,
    MapUpdateSchema,
    AudioUpdateSchema,
)

router = APIRouter(prefix="/parties", tags=["Parties"])
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
AUDIO_DIR = Path(__file__).resolve().parent.parent / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def get_base_races(is_dm: bool = False):
    f = DATA_DIR / "races.json"
    if not f.exists():
        return []
    try:
        races = json.loads(f.read_text(encoding="utf-8"))
        if not is_dm:
            return [r for r in races if not r.get("dm_only", False)]
        return races
    except Exception:
        return []


@router.post("/", response_model=PartyResponse, status_code=status.HTTP_201_CREATED, summary="Создать стол (партию)")
async def create_party(payload: PartyCreateSchema, db: DbSession, current_user: CurrentUser):
    existing = await db.execute(select(Party).where(Party.name == payload.name.strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Стол с таким названием уже существует.")

    pwd_hash = get_password_hash(payload.password) if (payload.is_private and payload.password) else None

    party = Party(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        dm_id=current_user.id,
        is_private=payload.is_private,
        password_hash=pwd_hash,
        settings={"theme": payload.theme or "ember", "max_players": payload.max_players or 6, "banner_url": ""},
        dm_notes="Добро пожаловать в сюжет вашей кампании! Здесь хранятся ваши мастерские тайны.",
        map_data={"image_url": "", "grid_size": 50, "tokens": []},
        audio_state={
            "current_track_url": "https://assets.mixkit.co/music/preview/mixkit-tavern-loop-11.mp3",
            "track_title": "Таверна у тракта",
            "is_playing": False,
            "volume": 70,
            "playlist": [
                {"title": "Таверна у тракта", "url": "https://assets.mixkit.co/music/preview/mixkit-tavern-loop-11.mp3"},
                {"title": "Боевой марш подземелья", "url": "https://assets.mixkit.co/music/preview/mixkit-game-level-music-689.mp3"},
                {"title": "Таинственный лес", "url": "https://assets.mixkit.co/music/preview/mixkit-medieval-fantasy-527.mp3"}
            ]
        },
        custom_races=[]
    )
    db.add(party)
    await db.commit()
    await db.refresh(party)

    member = PartyMember(party_id=party.id, user_id=current_user.id, character_id=None, player_notes="")
    db.add(member)

    welcome_msg = PartyMessage(
        party_id=party.id,
        user_id=current_user.id,
        sender_name="Летописец",
        message_type="system",
        content=f"Кампания «{party.name}» открыта! Мастер стола: {current_user.username}.",
        is_pinned=True,
    )
    db.add(welcome_msg)
    await db.commit()

    return PartyResponse(
        id=party.id,
        name=party.name,
        description=party.description,
        dm_id=party.dm_id,
        dm_username=current_user.username,
        is_private=party.is_private,
        members_count=1,
        max_players=party.settings.get("max_players", 6),
        theme=party.settings.get("theme", "ember"),
        created_at=party.created_at,
    )


@router.get("/", response_model=List[PartyResponse], summary="Список ОТКРЫТЫХ столов (закрытые скрыты)")
async def list_parties(db: DbSession, current_user: CurrentUser):
    stmt = (
        select(Party)
        .options(selectinload(Party.dm), selectinload(Party.members))
        .where(Party.is_private == False)
        .order_by(Party.id.desc())
    )
    res = await db.execute(stmt)
    parties = res.scalars().all()

    return [
        PartyResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            dm_id=p.dm_id,
            dm_username=p.dm.username if p.dm else "Мастер",
            is_private=p.is_private,
            members_count=len(p.members or []),
            max_players=(p.settings or {}).get("max_players", 6),
            theme=(p.settings or {}).get("theme", "ember"),
            created_at=p.created_at,
            banner_url=(p.settings or {}).get("banner_url", "")
        )
        for p in parties
    ]


@router.get("/my", response_model=List[PartyResponse], summary="Мои столы")
async def list_my_parties(db: DbSession, current_user: CurrentUser):
    stmt = (
        select(Party)
        .join(PartyMember, PartyMember.party_id == Party.id)
        .where(PartyMember.user_id == current_user.id)
        .options(selectinload(Party.dm), selectinload(Party.members))
        .distinct()
        .order_by(Party.id.desc())
    )
    res = await db.execute(stmt)
    parties = res.scalars().all()
    return [
        PartyResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            dm_id=p.dm_id,
            dm_username=p.dm.username if p.dm else "Мастер",
            is_private=p.is_private,
            members_count=len(p.members or []),
            max_players=(p.settings or {}).get("max_players", 6),
            theme=(p.settings or {}).get("theme", "ember"),
            created_at=p.created_at,
            banner_url=(p.settings or {}).get("banner_url", "")
        )
        for p in parties
    ]


@router.post("/join-by-name", summary="Вход в закрытый стол по названию и паролю")
async def join_party_by_name(payload: PartyJoinByNameSchema, db: DbSession, current_user: CurrentUser):
    stmt = select(Party).where(Party.name == payload.name.strip()).options(selectinload(Party.members))
    res = await db.execute(stmt)
    party = res.scalar_one_or_none()
    if not party:
        raise HTTPException(status_code=404, detail=f"Стол с названием «{payload.name}» не найден.")

    max_p = (party.settings or {}).get("max_players", 6)
    if len(party.members or []) >= max_p and party.dm_id != current_user.id:
        existing = any(m.user_id == current_user.id for m in party.members)
        if not existing:
            raise HTTPException(status_code=400, detail=f"Стол полнен! Лимит игроков ({max_p}).")

    if party.is_private and party.dm_id != current_user.id:
        if not payload.password or not verify_password(payload.password, party.password_hash or ""):
            raise HTTPException(status_code=403, detail="Неверный пароль.")

    existing_mem = await db.execute(
        select(PartyMember).where(PartyMember.party_id == party.id, PartyMember.user_id == current_user.id)
    )
    mem = existing_mem.scalar_one_or_none()
    if mem:
        if payload.character_id is not None:
            mem.character_id = payload.character_id
            await db.commit()
        return {"status": "already_member", "party_id": party.id}

    new_mem = PartyMember(party_id=party.id, user_id=current_user.id, character_id=payload.character_id, player_notes="")
    db.add(new_mem)
    await db.commit()
    return {"status": "joined", "party_id": party.id}


@router.post("/{party_id}/join", summary="Вступить в стол по ID")
async def join_party(party_id: int, payload: PartyJoinSchema, db: DbSession, current_user: CurrentUser):
    stmt = select(Party).where(Party.id == party_id).options(selectinload(Party.members))
    res = await db.execute(stmt)
    party = res.scalar_one_or_none()
    if not party:
        raise HTTPException(status_code=404, detail="Стол не найден.")

    max_p = (party.settings or {}).get("max_players", 6)
    if len(party.members or []) >= max_p and party.dm_id != current_user.id:
        existing = any(m.user_id == current_user.id for m in party.members)
        if not existing:
            raise HTTPException(status_code=400, detail=f"Стол полон! Лимит ({max_p}).")

    if party.is_private and party.dm_id != current_user.id:
        if not payload.password or not verify_password(payload.password, party.password_hash or ""):
            raise HTTPException(status_code=403, detail="Неверный пароль.")

    existing_mem = await db.execute(
        select(PartyMember).where(PartyMember.party_id == party_id, PartyMember.user_id == current_user.id)
    )
    mem = existing_mem.scalar_one_or_none()
    if mem:
        if payload.character_id is not None:
            mem.character_id = payload.character_id
            await db.commit()
        return {"status": "already_member", "party_id": party_id}

    new_mem = PartyMember(party_id=party_id, user_id=current_user.id, character_id=payload.character_id, player_notes="")
    db.add(new_mem)
    await db.commit()
    return {"status": "joined", "party_id": party_id}


@router.post("/{party_id}/attach-character", summary="Привязать персонажа к столу")
async def attach_character_to_party(party_id: int, payload: AttachCharacterSchema, db: DbSession, current_user: CurrentUser):
    char_res = await db.execute(select(Character).where(Character.id == payload.character_id, Character.user_id == current_user.id))
    char = char_res.scalar_one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Персонаж не найден.")

    mem_res = await db.execute(
        select(PartyMember).where(PartyMember.party_id == party_id, PartyMember.user_id == current_user.id)
    )
    mem = mem_res.scalar_one_or_none()
    if not mem:
        mem = PartyMember(party_id=party_id, user_id=current_user.id, character_id=payload.character_id, player_notes="")
        db.add(mem)
    else:
        mem.character_id = payload.character_id

    await db.commit()
    return {"status": "attached", "character_id": payload.character_id}


@router.patch("/{party_id}/members/{character_id}/hp", summary="Изменение HP")
async def update_party_member_hp(party_id: int, character_id: int, payload: dict, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party:
        raise HTTPException(status_code=404, detail="Стол не найден.")

    char_res = await db.execute(select(Character).where(Character.id == character_id))
    char = char_res.scalar_one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Персонаж не найден.")

    if party.dm_id != current_user.id and char.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав.")

    new_hp = payload.get("hp_current")
    if new_hp is not None:
        char.hp_current = max(0, min(char.hp_max or 10, int(new_hp)))
        await db.commit()
        await db.refresh(char)

    return {"status": "ok", "hp_current": char.hp_current, "hp_max": char.hp_max}


@router.get("/{party_id}", response_model=PartyDetailResponse, summary="Комната стола")
async def get_party_detail(party_id: int, db: DbSession, current_user: CurrentUser):
    stmt = (
        select(Party)
        .where(Party.id == party_id)
        .options(
            selectinload(Party.dm),
            selectinload(Party.members).selectinload(PartyMember.user),
            selectinload(Party.members).selectinload(PartyMember.character),
        )
    )
    res = await db.execute(stmt)
    party = res.scalar_one_or_none()
    if not party:
        raise HTTPException(status_code=404, detail="Стол не найден.")

    is_dm = (party.dm_id == current_user.id)
    my_membership = next((m for m in party.members if m.user_id == current_user.id), None)
    if party.is_private and not is_dm and not my_membership:
        raise HTTPException(status_code=403, detail="Закрытый стол.")

    members_resp = []
    for m in party.members:
        c = m.character
        cur_hp = getattr(c, "hp_current", 0) if c else None
        max_hp = getattr(c, "hp_max", 0) if c else None
        ac_val = getattr(c, "armor_class", None)
        if ac_val is None and c and c.stats:
            ac_val = 10 + (c.stats.get("dex", 10) - 10) // 2

        members_resp.append(PartyMemberResponse(
            id=m.id,
            user_id=m.user_id,
            username=m.user.username if m.user else "Герой",
            is_dm=(m.user_id == party.dm_id),
            character_id=m.character_id,
            character_name=c.name if c else None,
            character_class=f"{c.class_name} {c.level} ур." if c else None,
            character_level=c.level if c else None,
            character_hp=f"{cur_hp}/{max_hp} HP" if c else None,
            character_hp_current=cur_hp,
            character_hp_max=max_hp,
            character_ac=ac_val or 10,
            character_race=c.race if c else None,
            joined_at=m.joined_at,
        ))

    dm_notes_val = party.dm_notes if is_dm else None
    my_notes_val = my_membership.player_notes if (my_membership and my_membership.player_notes) else ""

    return PartyDetailResponse(
        id=party.id,
        name=party.name,
        description=party.description,
        dm_id=party.dm_id,
        dm_username=party.dm.username if party.dm else "Мастер",
        is_private=party.is_private,
        is_current_user_dm=is_dm,
        my_character_id=my_membership.character_id if my_membership else None,
        my_notes=my_notes_val,
        dm_notes=dm_notes_val,
        settings=party.settings or {"theme": "ember", "max_players": 6, "banner_url": ""},
        map_data=party.map_data or {"image_url": "", "grid_size": 50, "tokens": []},
        audio_state=party.audio_state or {"is_playing": False, "track_title": "Тишина", "volume": 70, "playlist": []},
        members=members_resp,
        custom_races=party.custom_races or [],
        created_at=party.created_at,
    )


@router.patch("/{party_id}/theme", summary="DM: Быстрая смена темы")
async def change_party_theme(party_id: int, payload: dict, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только Мастер стола может менять тему.")

    theme = payload.get("theme", "ember")
    cur_settings = dict(party.settings or {})
    cur_settings["theme"] = theme
    party.settings = cur_settings
    flag_modified(party, "settings")
    await db.commit()
    return {"status": "ok", "theme": theme}


@router.patch("/{party_id}/settings", summary="DM: Сохранить настройки")
async def update_party_settings(party_id: int, payload: UpdateSettingsSchema, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только Мастер.")

    cur_settings = dict(party.settings or {})
    if payload.name: party.name = payload.name.strip()
    if payload.description is not None: party.description = payload.description.strip()
    if payload.theme: cur_settings["theme"] = payload.theme
    if payload.banner_url is not None: cur_settings["banner_url"] = payload.banner_url.strip()
    if payload.max_players is not None: cur_settings["max_players"] = max(2, min(20, payload.max_players))

    if payload.is_private is not None:
        party.is_private = payload.is_private
        if payload.is_private and payload.password:
            party.password_hash = get_password_hash(payload.password)
        elif not payload.is_private:
            party.password_hash = None

    party.settings = cur_settings
    flag_modified(party, "settings")
    await db.commit()
    return {"status": "ok", "settings": party.settings}


@router.patch("/{party_id}/my-notes", summary="Игрок: Заметки")
async def update_player_notes(party_id: int, payload: NotesUpdateSchema, db: DbSession, current_user: CurrentUser):
    mem_res = await db.execute(select(PartyMember).where(PartyMember.party_id == party_id, PartyMember.user_id == current_user.id))
    mem = mem_res.scalar_one_or_none()
    if not mem: raise HTTPException(status_code=404, detail="Не участник.")
    mem.player_notes = payload.notes
    await db.commit()
    return {"status": "ok", "my_notes": mem.player_notes}


@router.patch("/{party_id}/dm-notes", summary="DM: Заметки сюжета")
async def update_dm_notes(party_id: int, payload: NotesUpdateSchema, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    party.dm_notes = payload.notes
    await db.commit()
    return {"status": "ok", "dm_notes": party.dm_notes}


@router.get("/{party_id}/map", summary="Карта")
async def get_party_map(party_id: int, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party: raise HTTPException(status_code=404, detail="Стол не найден.")
    return party.map_data or {"image_url": "", "grid_size": 50, "tokens": []}


@router.patch("/{party_id}/map", summary="Обновить карту")
async def update_party_map(party_id: int, payload: MapUpdateSchema, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party: raise HTTPException(status_code=404, detail="Стол не найден.")
    cur_map = dict(party.map_data or {"image_url": "", "grid_size": 50, "tokens": []})
    is_dm = (party.dm_id == current_user.id)
    if payload.image_url is not None:
        if not is_dm: raise HTTPException(status_code=403, detail="Только Мастер.")
        cur_map["image_url"] = payload.image_url.strip()
    if payload.grid_size is not None and is_dm: cur_map["grid_size"] = payload.grid_size
    if payload.tokens is not None: cur_map["tokens"] = payload.tokens
    party.map_data = cur_map
    flag_modified(party, "map_data")
    await db.commit()
    return cur_map


@router.get("/{party_id}/audio", summary="Аудио")
async def get_party_audio(party_id: int, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party: raise HTTPException(status_code=404, detail="Стол не найден.")
    return party.audio_state or {"is_playing": False, "track_title": "Тишина", "volume": 70, "playlist": []}


@router.patch("/{party_id}/audio", summary="Управление аудио")
async def update_party_audio(party_id: int, payload: AudioUpdateSchema, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    cur_audio = dict(party.audio_state or {})
    if payload.current_track_url is not None: cur_audio["current_track_url"] = payload.current_track_url
    if payload.track_title is not None: cur_audio["track_title"] = payload.track_title
    if payload.is_playing is not None: cur_audio["is_playing"] = payload.is_playing
    if payload.volume is not None: cur_audio["volume"] = payload.volume
    if payload.playlist is not None: cur_audio["playlist"] = payload.playlist
    party.audio_state = cur_audio
    flag_modified(party, "audio_state")
    await db.commit()
    return cur_audio


import shutil
import time
from pathlib import Path
from fastapi import UploadFile, File, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

# Вычисляем путь к app/static/audio надежно и абсолютно
AUDIO_DIR = Path(__file__).resolve().parent.parent / "static" / "audio"

@router.post("/{party_id}/audio/upload", summary="Загрузить MP3 файл трека")
async def upload_party_audio(
    party_id: int,
    file: UploadFile = File(...),
    db: DbSession = None,
    current_user: CurrentUser = None
):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только Мастер может загружать музыку.")

    # Проверка расширения файла
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ('.mp3', '.ogg', '.wav', '.m4a'):
        raise HTTPException(status_code=400, detail="Поддерживаются только аудиофайлы (.mp3, .ogg, .wav).")

    # Гарантируем, что папка static/audio точно существует
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    # Имя файла без пробелов и спецсимволов
    clean_name = f"party_{party_id}_{int(time.time())}_{Path(file.filename).stem[:30].replace(' ', '_')}{suffix}"
    destination_file = AUDIO_DIR / clean_name

    # Сохраняем файл на диск
    with open(destination_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/static/audio/{clean_name}"
    track_title = Path(file.filename).stem

    # Обновляем плейлист в audio_state стола
    cur_audio = dict(party.audio_state or {})
    pl = list(cur_audio.get("playlist", []))
    pl.append({"title": track_title, "url": file_url})
    cur_audio["playlist"] = pl

    party.audio_state = cur_audio
    flag_modified(party, "audio_state")
    await db.commit()

    return {"status": "ok", "track": {"title": track_title, "url": file_url}}



@router.delete("/{party_id}/audio/track/{track_idx}", summary="Удалить трек")
async def delete_party_track(party_id: int, track_idx: int, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    cur_audio = dict(party.audio_state or {})
    pl = list(cur_audio.get("playlist", []))
    if 0 <= track_idx < len(pl):
        pl.pop(track_idx)
        cur_audio["playlist"] = pl
        party.audio_state = cur_audio
        flag_modified(party, "audio_state")
        await db.commit()
    return {"status": "ok", "playlist": pl}


@router.patch("/{party_id}/audio/track/{track_idx}", summary="Переименовать трек")
async def rename_party_track(party_id: int, track_idx: int, payload: dict, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    new_title = payload.get("title", "").strip()
    cur_audio = dict(party.audio_state or {})
    pl = list(cur_audio.get("playlist", []))
    if 0 <= track_idx < len(pl) and new_title:
        pl[track_idx]["title"] = new_title
        cur_audio["playlist"] = pl
        party.audio_state = cur_audio
        flag_modified(party, "audio_state")
        await db.commit()
    return {"status": "ok", "playlist": pl}


@router.get("/{party_id}/messages", summary="Сообщения")
async def get_party_messages(party_id: int, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party: raise HTTPException(status_code=404, detail="Стол не найден.")
    is_dm = (party.dm_id == current_user.id)
    stmt = select(PartyMessage).where(PartyMessage.party_id == party_id).order_by(PartyMessage.id.asc())
    res = await db.execute(stmt)
    all_msgs = res.scalars().all()
    visible = []
    for m in all_msgs:
        if m.message_type == "secret_roll":
            if is_dm: visible.append(m)
            else:
                masked = PartyMessage(
                    id=m.id, party_id=m.party_id, user_id=m.user_id, sender_name="👑 Мастер (За ширмой)",
                    message_type="system", content="🎲 Мастер совершил бросок кубиков за ширмой... (Результат скрыт)",
                    is_pinned=False, created_at=m.created_at
                )
                visible.append(masked)
            continue
        if m.whisper_to_id is not None:
            if is_dm or m.user_id == current_user.id or m.whisper_to_id == current_user.id: visible.append(m)
        else: visible.append(m)
    return visible


@router.post("/{party_id}/messages", summary="Отправить")
async def send_party_message(party_id: int, payload: SendMessageSchema, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party: raise HTTPException(status_code=404, detail="Стол не найден.")
    is_dm = (party.dm_id == current_user.id)
    sender_title = f"👑 {current_user.username}" if is_dm else current_user.username
    mem_res = await db.execute(select(PartyMember).where(PartyMember.party_id == party_id, PartyMember.user_id == current_user.id))
    mem = mem_res.scalar_one_or_none()
    if mem and mem.character_id:
        c_res = await db.execute(select(Character).where(Character.id == mem.character_id))
        c = c_res.scalar_one_or_none()
        if c: sender_title = f"{c.name} ({current_user.username})"

    msg = PartyMessage(
        party_id=party_id, user_id=current_user.id, sender_name=sender_title,
        message_type="whisper" if payload.whisper_to_id else "chat",
        content=payload.content.strip(), whisper_to_id=payload.whisper_to_id,
        is_pinned=(payload.is_pinned if is_dm else False)
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.patch("/{party_id}/messages/{message_id}/pin", summary="Закреп")
async def toggle_pin_message(party_id: int, message_id: int, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    msg_res = await db.execute(select(PartyMessage).where(PartyMessage.id == message_id, PartyMessage.party_id == party_id))
    msg = msg_res.scalar_one_or_none()
    if not msg: raise HTTPException(status_code=404, detail="Сообщение не найдено.")
    msg.is_pinned = not msg.is_pinned
    await db.commit()
    return {"status": "ok", "is_pinned": msg.is_pinned}


@router.post("/{party_id}/secret-roll", summary="Ширма")
async def dm_secret_roll(party_id: int, payload: dict, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    dice, mod, title = int(payload.get("dice_sides", 20)), int(payload.get("modifier", 0)), payload.get("title", "Тайная проверка")
    val = random.randint(1, dice)
    total = val + mod
    res_str = f"d{dice} ({val}) {('+' if mod>=0 else '')+str(mod)} = {total}"
    msg = PartyMessage(party_id=party_id, user_id=current_user.id, sender_name="👑 Мастер (За ширмой)", message_type="secret_roll", content=f"🔒 [{title}] {res_str}")
    db.add(msg)
    await db.commit()
    return {"status": "ok", "result": res_str, "total": total}


@router.post("/{party_id}/roll-stat", summary="Бросок")
async def roll_party_stat(party_id: int, payload: RollStatSchema, db: DbSession, current_user: CurrentUser):
    d20 = random.randint(1, 20)
    total = d20 + payload.stat_mod
    mod_str = f"+{payload.stat_mod}" if payload.stat_mod >= 0 else str(payload.stat_mod)
    hero_name = payload.character_name or current_user.username
    crit = " 🔥 НАТУРАЛЬНЫЙ 20!" if d20 == 20 else (" 💀 КРИТИЧЕСКИЙ ПРОВАЛ 1!" if d20 == 1 else "")
    content = f"🎲 {hero_name} проверяет [{payload.stat_name}]: d20 ({d20}) {mod_str} = {total}{crit}"
    msg = PartyMessage(party_id=party_id, user_id=current_user.id, sender_name=hero_name, message_type="roll", content=content)
    db.add(msg)
    await db.commit()
    return {"status": "ok", "content": content, "total": total}


@router.post("/{party_id}/npc", summary="НИП")
async def create_quick_npc(party_id: int, payload: QuickNPCCreateSchema, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    npc = Character(name=payload.name.strip(), race=payload.race.strip(), class_name=payload.class_name.strip(), level=1, hp_max=payload.hp_max, hp_current=payload.hp_max, armor_class=payload.armor_class, stats={"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}, backstory=payload.notes, is_npc=True, user_id=current_user.id)
    db.add(npc)
    await db.commit()
    await db.refresh(npc)
    return {"status": "ok", "npc_id": npc.id, "name": npc.name}


@router.get("/{party_id}/npcs", summary="Список НИПов Мастера")
async def get_party_npcs(party_id: int, db: DbSession, current_user: CurrentUser):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party:
        raise HTTPException(status_code=404, detail="Стол не найден.")

    # Строгая проверка: если зашел не создатель стола (не DM), закрываем доступ
    if party.dm_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ к НИПам имеет только Мастер стола.")

    # Выбираем только НИПы, созданные Мастером этого стола
    stmt = select(Character).where(
        Character.user_id == party.dm_id,
        Character.is_npc == True
    ).order_by(Character.id.desc())

    res = await db.execute(stmt)
    chars = res.scalars().all()

    return [{
        "id": c.id,
        "name": c.name,
        "race": c.race,
        "class_name": c.class_name,
        "level": c.level,
        "hp_current": getattr(c, "hp_current", 10),
        "hp_max": getattr(c, "hp_max", 10),
        "is_npc": getattr(c, "is_npc", False),
        "backstory": c.backstory or "",
        "avatar_url": getattr(c, "avatar_url", None),
        "banner_url": getattr(c, "banner_url", None)
    } for c in chars]


@router.post("/{party_id}/races", summary="Раса стола")
async def add_custom_race_to_party(party_id: int, payload: CustomRaceCreateSchema, db: DbSession, current_user: CurrentUser):
    stmt = select(Party).where(Party.id == party_id)
    res = await db.execute(stmt)
    party = res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    race_id = f"custom_{party_id}_" + payload.name.lower().replace(" ", "_")
    cur_races = list(party.custom_races or [])
    new_race = {"id": race_id, "name": payload.name.strip(), "speed": payload.speed, "description": payload.description.strip(), "ability_bonuses": payload.ability_bonuses, "traits": payload.traits, "dm_only": payload.dm_only, "is_custom": True, "party_id": party_id}
    cur_races.append(new_race)
    party.custom_races = cur_races
    flag_modified(party, "custom_races")
    await db.commit()
    return new_race


@router.delete("/{party_id}/races/{race_id}", summary="Удалить расу")
async def delete_custom_race_from_party(party_id: int, race_id: str, db: DbSession, current_user: CurrentUser):
    stmt = select(Party).where(Party.id == party_id)
    res = await db.execute(stmt)
    party = res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id: raise HTTPException(status_code=403, detail="Только Мастер.")
    party.custom_races = [r for r in list(party.custom_races or []) if r.get("id") != race_id]
    flag_modified(party, "custom_races")
    await db.commit()
    return {"status": "ok"}


@router.get("/{party_id}/compendium/races", summary="Все расы")
async def get_party_races(party_id: int, db: DbSession, current_user: CurrentUser):
    stmt = select(Party).where(Party.id == party_id)
    res = await db.execute(stmt)
    party = res.scalar_one_or_none()
    if not party: raise HTTPException(status_code=404, detail="Стол не найден.")
    is_dm = (party.dm_id == current_user.id)
    base_races = get_base_races(is_dm=is_dm)
    custom_races = list(party.custom_races or [])
    if not is_dm: custom_races = [r for r in custom_races if not r.get("dm_only", False)]
    return custom_races + base_races

import shutil
import time
from fastapi import UploadFile, File

@router.post("/{party_id}/audio/upload", summary="Загрузить MP3 файл трека")
async def upload_party_audio(
    party_id: int,
    file: UploadFile = File(...),
    db: DbSession = None,
    current_user: CurrentUser = None
):
    party_res = await db.execute(select(Party).where(Party.id == party_id))
    party = party_res.scalar_one_or_none()
    if not party or party.dm_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только Мастер может загружать музыку.")

    if not file.filename.lower().endswith(('.mp3', '.ogg', '.wav', '.m4a')):
        raise HTTPException(status_code=400, detail="Поддерживаются только аудиофайлы (MP3, OGG, WAV).")

    audio_dir = Path("app/static/audio")
    audio_dir.mkdir(parents=True, exist_ok=True)

    clean_filename = f"party_{party_id}_{int(time.time())}_{file.filename.replace(' ', '_')}"
    file_path = audio_dir / clean_filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/static/audio/{clean_filename}"
    track_title = file.filename.rsplit('.', 1)[0]

    cur_audio = dict(party.audio_state or {})
    pl = list(cur_audio.get("playlist", []))
    pl.append({"title": track_title, "url": file_url})
    cur_audio["playlist"] = pl

    party.audio_state = cur_audio
    flag_modified(party, "audio_state")
    await db.commit()

    return {"status": "ok", "track": {"title": track_title, "url": file_url}}