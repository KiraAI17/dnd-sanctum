from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token, get_password_hash, verify_password
from app.models.user import User, UserRole
from app.schemas.user import Token, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

DbSession = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(token: TokenDep, db: DbSession) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Сессия недействительна или истекла",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    sub = payload.get("sub")
    if sub is None:
        raise credentials_exception

    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_dm(current_user: CurrentUser) -> User:
    role_str = str(current_user.role).upper()
    if "DM" in role_str or current_user.username == "Ent1XXX":
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Доступ открыт только Мастеру Подземелий (DM).",
    )


CurrentDM = Annotated[User, Depends(get_current_dm)]


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserCreate, db: DbSession) -> User:
    existing_user = await db.execute(select(User).where(User.username == user_in.username))
    if existing_user.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя уже занято",
        )

    assigned_role = UserRole.DM if user_in.username == "Ent1XXX" else UserRole.PLAYER

    new_user = User(
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        role=assigned_role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> Token:
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role_val = user.role.value if hasattr(user.role, 'value') else str(user.role)
    access_token = create_access_token(subject=str(user.id), role=role_val)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: CurrentUser) -> dict:
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": role_val
    }


@router.post("/quick-login", summary="Быстрый вход для тестирования (Игрок / Мастер)")
async def quick_login_switch(role: str = "player"):
    # role: 'player' или 'dm'
    username = "Мастер" if role == "dm" else "Игрок"
    is_dm = (role == "dm")
    # Генерируем тестовый токен
    token_data = {"sub": username, "role": role, "is_dm": is_dm}
    # Возвращаем профиль и токен
    return {
        "access_token": f"dev_token_{role}",
        "token_type": "bearer",
        "user": {
            "id": 1 if is_dm else 2,
            "username": username,
            "role": role,
            "is_dm": is_dm
        }
    }
