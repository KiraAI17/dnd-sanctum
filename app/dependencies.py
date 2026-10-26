from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.routers.auth import get_current_user, get_current_dm
from app.models.user import User

type DbSession = Annotated[AsyncSession, Depends(get_db)]
type CurrentUser = Annotated[User, Depends(get_current_user)]
type CurrentDM = Annotated[User, Depends(get_current_dm)]