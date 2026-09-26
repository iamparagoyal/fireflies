from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app import models, schemas
from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.services import meetings as meeting_service
from app.services.search import search_transcripts

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/me", response_model=schemas.AppInfo)
def me(user: CurrentUser):
    settings = get_settings()
    enabled = bool(settings.anthropic_api_key)
    return schemas.AppInfo(
        user=schemas.UserOut.model_validate(user),
        llm_enabled=enabled,
        llm_model=settings.anthropic_model if enabled else None,
    )


@router.get("/participants", response_model=list[schemas.ParticipantOut])
def list_participants(db: DbSession, user: CurrentUser):
    return list(
        db.scalars(
            select(models.Participant)
            .join(models.MeetingParticipant)
            .join(models.Meeting)
            .where(models.Meeting.owner_id == user.id)
            .group_by(models.Participant.id)
            .order_by(func.lower(models.Participant.name))
        )
    )


@router.get("/tags", response_model=list[schemas.TagOut])
def list_tags(db: DbSession):
    return list(db.scalars(select(models.Tag).order_by(func.lower(models.Tag.name))))


@router.post("/tags", response_model=schemas.TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(payload: schemas.TagIn, db: DbSession):
    if db.scalar(select(models.Tag).where(func.lower(models.Tag.name) == payload.name.strip().lower())):
        raise HTTPException(status_code=409, detail="A tag with that name already exists")
    tag = meeting_service.get_or_create_tag(db, payload.name, payload.color)
    db.commit()
    return tag


@router.get("/search", response_model=schemas.SearchResponse)
def search(db: DbSession, user: CurrentUser, q: Annotated[str, Query(min_length=1, max_length=200)]):
    meetings, _ = meeting_service.list_meetings(db, user, q, [], [], None, None, "recent", 1, 10)
    counts = meeting_service.action_item_counts(db, [m.id for m in meetings])
    return schemas.SearchResponse(
        query=q,
        meetings=[meeting_service.to_list_item(m, counts.get(m.id, (0, 0))) for m in meetings],
        hits=search_transcripts(db, user, q),
    )
