from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import ValidationError

from app import schemas
from app.deps import CurrentUser, DbSession, get_owned_meeting
from app.services import export, meetings as meeting_service, qa
from app.services.transcript_parser import TranscriptParseError, parse_transcript

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@router.get("", response_model=schemas.MeetingPage)
def list_meetings(
    db: DbSession,
    user: CurrentUser,
    q: str | None = None,
    participant_id: Annotated[list[int], Query()] = [],
    tag_id: Annotated[list[int], Query()] = [],
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort: schemas.SortOrder = "recent",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
):
    items, total = meeting_service.list_meetings(
        db, user, q, participant_id, tag_id, date_from, date_to, sort, page, page_size
    )
    counts = meeting_service.action_item_counts(db, [m.id for m in items])
    return schemas.MeetingPage(
        items=[meeting_service.to_list_item(m, counts.get(m.id, (0, 0))) for m in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def _parse_or_422(content: str | None, fmt: str, filename: str | None = None):
    if not content or not content.strip():
        return None
    try:
        return parse_transcript(content, fmt, filename)
    except TranscriptParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("", response_model=schemas.MeetingDetail, status_code=status.HTTP_201_CREATED)
def create_meeting(payload: schemas.MeetingCreate, db: DbSession, user: CurrentUser):
    parsed = _parse_or_422(payload.transcript, payload.transcript_format)
    meeting = meeting_service.create_meeting(db, user, payload, parsed, source="paste" if parsed else "form")
    return meeting_service.to_detail(get_owned_meeting(db, user, meeting.id))


@router.post("/upload", response_model=schemas.MeetingDetail, status_code=status.HTTP_201_CREATED)
async def upload_meeting(
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    started_at: datetime | None = Form(None),
    platform: str = Form("upload"),
    participants: str | None = Form(None, description="Comma separated participant names"),
    tag_ids: str | None = Form(None, description="Comma separated tag ids"),
):
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Transcript file must be under 5 MB")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="Transcript must be a UTF-8 text file") from exc

    parsed = _parse_or_422(content, "auto", file.filename)
    if not parsed:
        raise HTTPException(status_code=422, detail="Transcript file is empty")

    default_title = (file.filename or "Uploaded meeting").rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip()
    try:
        payload = schemas.MeetingCreate(
            title=(title or default_title or "Uploaded meeting")[:255],
            started_at=started_at,
            platform=platform,
            participants=[schemas.ParticipantIn(name=n) for n in (participants or "").split(",") if n.strip()],
            tag_ids=[int(t) for t in (tag_ids or "").split(",") if t.strip().isdigit()],
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_url=False)) from exc

    meeting = meeting_service.create_meeting(db, user, payload, parsed, source="upload")
    return meeting_service.to_detail(get_owned_meeting(db, user, meeting.id))


@router.get("/{meeting_id}", response_model=schemas.MeetingDetail)
def get_meeting(meeting_id: int, db: DbSession, user: CurrentUser):
    return meeting_service.to_detail(get_owned_meeting(db, user, meeting_id))


@router.get("/{meeting_id}/transcript", response_model=list[schemas.SegmentOut])
def get_transcript(meeting_id: int, db: DbSession, user: CurrentUser):
    return meeting_service.to_segments(db, get_owned_meeting(db, user, meeting_id))


@router.patch("/{meeting_id}", response_model=schemas.MeetingDetail)
def update_meeting(meeting_id: int, payload: schemas.MeetingUpdate, db: DbSession, user: CurrentUser):
    meeting = get_owned_meeting(db, user, meeting_id)
    if payload.title is not None:
        meeting.title = payload.title.strip()
    if payload.started_at is not None:
        meeting.started_at = payload.started_at.replace(tzinfo=None)
    if payload.platform is not None:
        meeting.platform = payload.platform
    if payload.participants is not None:
        meeting_service.set_participants(db, meeting, payload.participants)
    if payload.tag_ids is not None:
        meeting_service.set_tags(db, meeting, payload.tag_ids)
    db.commit()
    db.expire_all()
    return meeting_service.to_detail(get_owned_meeting(db, user, meeting_id))


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: int, db: DbSession, user: CurrentUser):
    db.delete(get_owned_meeting(db, user, meeting_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{meeting_id}/regenerate", response_model=schemas.MeetingDetail)
def regenerate(meeting_id: int, db: DbSession, user: CurrentUser):
    meeting = get_owned_meeting(db, user, meeting_id)
    if not meeting.segments:
        raise HTTPException(status_code=409, detail="Meeting has no transcript to summarize")
    meeting_service.regenerate_notes(db, meeting)
    db.commit()
    db.expire_all()
    return meeting_service.to_detail(get_owned_meeting(db, user, meeting_id))


@router.post("/{meeting_id}/ask", response_model=schemas.AskResponse)
def ask(meeting_id: int, payload: schemas.AskRequest, db: DbSession, user: CurrentUser):
    return qa.answer_question(get_owned_meeting(db, user, meeting_id), payload.question)


@router.get("/{meeting_id}/export")
def export_meeting(meeting_id: int, db: DbSession, user: CurrentUser, format: Literal["md", "txt"] = "md"):
    meeting = get_owned_meeting(db, user, meeting_id)
    body = export.to_markdown(meeting) if format == "md" else export.to_text(meeting)
    slug = "".join(c if c.isalnum() else "-" for c in meeting.title.lower()).strip("-")[:60] or "meeting"
    media_type = "text/markdown" if format == "md" else "text/plain"
    return Response(
        content=body,
        media_type=f"{media_type}; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{slug}.{format}"'},
    )
