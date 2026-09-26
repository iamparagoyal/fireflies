from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.fts import install_fts
from app.routers import action_items, collaboration, meetings, workspace
from app.seed.loader import seed_database


def init_db() -> None:
    Base.metadata.create_all(engine)
    install_fts(engine)
    if get_settings().seed_on_startup:
        with SessionLocal() as db:
            seed_database(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Fireflies Clone API", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(workspace.router)
app.include_router(meetings.router)
app.include_router(action_items.router)
app.include_router(collaboration.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
