from fastapi.templating import Jinja2Templates
import html
import sys
import traceback
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

import app.models # noqa: F401
from app.core.config import settings
from app.core.database import Base, engine
from app.routers import parties,  auth, characters, compendium, pages


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(

    title=settings.PROJECT_NAME,
    version="0.3.0",
    debug=True,
    lifespan=lifespan,
)

templates = Jinja2Templates(directory="app/templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))

    print(f"\n{'=' * 70}", file=sys.stderr, flush=True)
    print(f"CRITICAL ERROR ON: {request.method} {request.url}", file=sys.stderr, flush=True)
    print(tb_str, file=sys.stderr, flush=True)
    print(f"{'=' * 70}\n", file=sys.stderr, flush=True)

    accept_header = request.headers.get("accept", "")
    if "application/json" in accept_header:
        return JSONResponse(
            status_code=500,
            content={
                "error": type(exc).__name__,
                "detail": str(exc),
                "path": str(request.url),
                "traceback": tb_str.splitlines(),
            },
        )

    escaped_tb = html.escape(tb_str)
    escaped_err = html.escape(str(exc))

    html_content = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>500 Internal Server Error — Debug</title>
        <style>
            body {{ font-family: Consolas, Monaco, monospace; background: #18181b; color: #f4f4f5; padding: 24px; margin: 0; }}
            .header {{ background: #7f1d1d; border-left: 6px solid #ef4444; padding: 16px; border-radius: 4px; margin-bottom: 20px; }}
            h1 {{ margin: 0 0 8px 0; font-size: 20px; color: #fecaca; }}
            .meta {{ color: #fca5a5; font-size: 14px; }}
            pre {{ background: #27272a; padding: 16px; border-radius: 6px; overflow-x: auto; line-height: 1.45; color: #e4e4e7; border: 1px solid #3f3f46; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{type(exc).__name__}: {escaped_err}</h1>
            <div class="meta">Endpoint: <strong>{request.method} {html.escape(str(request.url))}</strong></div>
        </div>
        <h3>Traceback:</h3>
        <pre>{escaped_tb}</pre>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=500)


@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        return await global_exception_handler(request, exc)


# Роутеры API и фронтенда
app.include_router(auth.router)

from fastapi.responses import RedirectResponse

@app.get("/characters", include_in_schema=False)
async def redirect_characters_to_root():
    return RedirectResponse(url="/", status_code=303)

app.include_router(characters.router)
app.include_router(compendium.router)
app.include_router(pages.router)


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "system": "D&D 5e Backend Ready"}

app.include_router(parties.router)

@app.get("/parties-lobby", include_in_schema=False)
async def parties_lobby_page(request: Request):
    return templates.TemplateResponse(request=request, name="parties.html")

@app.get("/party/{party_id}", include_in_schema=False)
async def party_room_page(request: Request, party_id: int):
    return templates.TemplateResponse(request=request, name="party_detail.html", context={"party_id": party_id})

@app.get("/characters/{character_id}/sheet", include_in_schema=False)
@app.get("/sheet/{character_id}", include_in_schema=False)
async def character_sheet_page(request: Request, character_id: int):
    return templates.TemplateResponse(request=request, name="sheet.html", context={"character_id": character_id})


@app.get("/", include_in_schema=False)
async def home_dashboard_page(request: Request):
    return templates.TemplateResponse(request=request, name="dashboard.html")

from pathlib import Path
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent

# Папка static внутри app (app/static)
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "audio").mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")