from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["Pages"])

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@router.get("/", response_class=HTMLResponse)
async def get_dashboard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={"page_title": "Чертоги Героев"},
    )


@router.get("/auth", response_class=HTMLResponse)
async def get_auth_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="auth.html",
        context={"page_title": "Вход"},
    )


@router.get("/sheet/{character_id}", response_class=HTMLResponse)
async def get_sheet_page(character_id: int, request: Request):
    return templates.TemplateResponse(
        request=request,
        name="sheet.html",
        context={"character_id": character_id},
    )


@router.get("/wizard", response_class=HTMLResponse)
async def get_wizard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="wizard.html",
        context={"page_title": "Мастер создания героя"},
    )
