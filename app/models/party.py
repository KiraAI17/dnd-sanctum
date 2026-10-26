#app/models/party
import datetime
from typing import TYPE_CHECKING, Optional, List, Dict, Any
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.character import Character


class Party(Base):
    __tablename__ = "parties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dm_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Кастомизация оформления и лимитов
    settings: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=lambda: {"theme": "ember", "max_players": 6, "banner_url": ""},
        nullable=False
    )

    # Личные сюжетные заметки Мастера (скрыты от игроков)
    dm_notes: Mapped[Optional[str]] = mapped_column(Text, default="", nullable=True)

    # Интерактивная тактическая карта стола
    map_data: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=lambda: {"image_url": "", "grid_size": 50, "tokens": []},
        nullable=False
    )

    # Плеер атмосферной музыки и плейлисты Мастера (синхронизация со столом)
    audio_state: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=lambda: {
            "current_track_url": "",
            "track_title": "Тишина",
            "is_playing": False,
            "volume": 70,
            "playlist": [
                {"title": "Таверна у тракта", "url": "https://assets.mixkit.co/music/preview/mixkit-tavern-loop-11.mp3"},
                {"title": "Боевой марш подземелья", "url": "https://assets.mixkit.co/music/preview/mixkit-game-level-music-689.mp3"}
            ]
        },
        nullable=False
    )

    # Авторские расы стола
    custom_races: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    dm: Mapped["User"] = relationship("User", foreign_keys=[dm_id], lazy="selectin")
    members: Mapped[List["PartyMember"]] = relationship(
        "PartyMember", back_populates="party", cascade="all, delete-orphan", lazy="selectin"
    )
    messages: Mapped[List["PartyMessage"]] = relationship(
        "PartyMessage", back_populates="party", cascade="all, delete-orphan", lazy="selectin",
        order_by="PartyMessage.id"
    )


class PartyMember(Base):
    __tablename__ = "party_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    party_id: Mapped[int] = mapped_column(Integer, ForeignKey("parties.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    character_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)

    # Личные скрытые заметки игрока
    player_notes: Mapped[Optional[str]] = mapped_column(Text, default="", nullable=True)

    joined_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    party: Mapped["Party"] = relationship("Party", back_populates="members")
    user: Mapped["User"] = relationship("User", lazy="selectin")
    character: Mapped[Optional["Character"]] = relationship("Character", lazy="selectin")


class PartyMessage(Base):
    __tablename__ = "party_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    party_id: Mapped[int] = mapped_column(Integer, ForeignKey("parties.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    sender_name: Mapped[str] = mapped_column(String(100), nullable=False)
    message_type: Mapped[str] = mapped_column(String(20), default="chat", nullable=False) # 'chat', 'roll', 'whisper', 'system', 'secret_roll'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    whisper_to_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    whisper_to_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    roll_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    party: Mapped["Party"] = relationship("Party", back_populates="messages")
    user: Mapped["User"] = relationship("User", lazy="selectin")
