import enum
from typing import TYPE_CHECKING
from sqlalchemy import Enum as SQLEnum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.character import Character


class UserRole(str, enum.Enum):
    DM = "DM"
    PLAYER = "PLAYER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), default=UserRole.PLAYER, nullable=False)

    characters: Mapped[list["Character"]] = relationship(
        "Character",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
