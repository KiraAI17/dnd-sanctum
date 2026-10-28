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


import json
from fastapi import Request
from fastapi.responses import HTMLResponse

from pathlib import Path

# app/routers/pages.py -> parent (app) -> data -> spells.json
SPELLS_FILE = Path(__file__).resolve().parent.parent / "data" / "spells.json"
if not SPELLS_FILE.exists():
    SPELLS_FILE = Path(__file__).resolve().parent.parent / "app" / "data" / "spells.json"


@router.get("/spells", response_class=HTMLResponse)
async def spells_grimoire_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="spells_grimoire.html",
        context={}
    )


@router.get("/compendium/spells-list")
async def get_all_spells():
    if SPELLS_FILE.exists():
        with open(SPELLS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


from fastapi import APIRouter, Request, Depends, HTTPException, status


@router.get("/map-editor", response_class=HTMLResponse)
async def map_editor_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="map_editor.html",
        context={}
    )