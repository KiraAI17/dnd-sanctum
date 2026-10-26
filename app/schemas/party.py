import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PartyCreateSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Название стола/партии")
    description: Optional[str] = Field(None, max_length=1000)
    is_private: bool = Field(default=False)
    password: Optional[str] = Field(None, min_length=1, max_length=100, description="Пароль для приватной группы")
    max_players: int = Field(default=6, ge=2, le=20)
    theme: str = Field(default="ember")


class PartyJoinSchema(BaseModel):
    password: Optional[str] = None
    character_id: Optional[int] = None


class PartyJoinByNameSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    password: Optional[str] = None
    character_id: Optional[int] = None


class AttachCharacterSchema(BaseModel):
    character_id: int


class QuickNPCCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    race: str = Field(default="Гуманоид")
    class_name: str = Field(default="НИП")
    hp_max: int = Field(default=20, ge=1)
    armor_class: int = Field(default=12, ge=1)
    notes: Optional[str] = ""


class PartyMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    is_dm: bool
    character_id: Optional[int] = None
    character_name: Optional[str] = None
    character_class: Optional[str] = None
    character_level: Optional[int] = None
    character_hp: Optional[str] = None
    character_hp_current: Optional[int] = None
    character_hp_max: Optional[int] = None
    character_ac: Optional[int] = None
    character_race: Optional[str] = None
    avatar_url: Optional[str] = None # <-- Добавьте для аватаров в отряде
    banner_url: Optional[str] = None # <-- Добавьте для баннеров
    joined_at: datetime.datetime




class PartyResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    dm_id: int
    dm_username: str
    is_private: bool
    members_count: int
    max_players: int = 6
    theme: str = "ember"
    banner_url: Optional[str] = "" # <-- Добавили
    created_at: datetime.datetime


class PartyDetailResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    dm_id: int
    dm_username: str
    is_private: bool
    is_current_user_dm: bool
    my_character_id: Optional[int] = None
    my_notes: str = ""
    dm_notes: Optional[str] = None
    settings: Dict[str, Any] = {}
    map_data: Dict[str, Any] = {}
    audio_state: Dict[str, Any] = {}
    members: List[PartyMemberResponse]
    custom_races: List[Dict[str, Any]] = []
    created_at: datetime.datetime


class CustomRaceCreateSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    speed: int = 30
    description: str = ""
    ability_bonuses: Dict[str, int] = {}
    traits: List[Dict[str, str]] = []
    dm_only: bool = False


class SendMessageSchema(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    whisper_to_id: Optional[int] = None
    is_pinned: bool = False


class RollStatSchema(BaseModel):
    stat_name: str
    stat_mod: int
    character_name: Optional[str] = None


class MessageResponseSchema(BaseModel):
    id: int
    party_id: int
    user_id: int
    sender_name: str
    message_type: str
    content: str
    whisper_to_id: Optional[int] = None
    whisper_to_name: Optional[str] = None
    is_pinned: bool
    roll_data: Optional[Dict[str, Any]] = None
    created_at: datetime.datetime


class UpdateSettingsSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None
    max_players: Optional[int] = None
    is_private: Optional[bool] = None
    password: Optional[str] = None
    banner_url: Optional[str] = None


class NotesUpdateSchema(BaseModel):
    notes: str


class MapUpdateSchema(BaseModel):
    image_url: Optional[str] = None
    grid_size: Optional[int] = None
    tokens: Optional[List[Dict[str, Any]]] = None


class AudioUpdateSchema(BaseModel):
    current_track_url: Optional[str] = None
    track_title: Optional[str] = None
    is_playing: Optional[bool] = None
    volume: Optional[int] = None
    playlist: Optional[List[Dict[str, str]]] = None
