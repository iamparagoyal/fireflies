from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import models, schemas
from app.deps import CurrentUser, DbSession, get_owned_meeting

router = APIRouter(prefix="/api", tags=["comments & soundbites"])


def _owned_segment(db: DbSession, user: models.User, segment_id: int) -> models.TranscriptSegment:
    segment = db.scalar(
        select(models.TranscriptSegment)
        .join(models.Meeting)
        .where(models.TranscriptSegment.id == segment_id, models.Meeting.owner_id == user.id)
    )
    if segment is None:
        raise HTTPException(status_code=404, detail="Transcript segment not found")
    return segment


@router.get("/meetings/{meeting_id}/comments", response_model=list[schemas.CommentOut])
def list_comments(meeting_id: int, db: DbSession, user: CurrentUser):
    get_owned_meeting(db, user, meeting_id)
    return list(
        db.scalars(
            select(models.Comment)
            .join(models.TranscriptSegment)
            .where(models.TranscriptSegment.meeting_id == meeting_id)
            .options(selectinload(models.Comment.author))
            .order_by(models.TranscriptSegment.position, models.Comment.created_at)
        )
    )


@router.post("/segments/{segment_id}/comments", response_model=schemas.CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(segment_id: int, payload: schemas.CommentCreate, db: DbSession, user: CurrentUser):
    segment = _owned_segment(db, user, segment_id)
    comment = models.Comment(segment_id=segment.id, author_id=user.id, body=payload.body.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: DbSession, user: CurrentUser):
    comment = db.get(models.Comment, comment_id)
    if comment is None or comment.author_id != user.id:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/meetings/{meeting_id}/soundbites", response_model=schemas.SoundbiteOut, status_code=status.HTTP_201_CREATED
)
def create_soundbite(meeting_id: int, payload: schemas.SoundbiteCreate, db: DbSession, user: CurrentUser):
    meeting = get_owned_meeting(db, user, meeting_id)
    if payload.end_seconds <= payload.start_seconds:
        raise HTTPException(status_code=422, detail="Soundbite must end after it starts")
    if payload.start_seconds > meeting.duration_seconds:
        raise HTTPException(status_code=422, detail="Soundbite starts after the meeting ends")
    soundbite = models.Soundbite(
        meeting_id=meeting.id,
        created_by_id=user.id,
        title=payload.title.strip(),
        start_seconds=payload.start_seconds,
        end_seconds=min(payload.end_seconds, float(meeting.duration_seconds) or payload.end_seconds),
    )
    db.add(soundbite)
    db.commit()
    db.refresh(soundbite)
    return soundbite


@router.delete("/soundbites/{soundbite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_soundbite(soundbite_id: int, db: DbSession, user: CurrentUser):
    soundbite = db.scalar(
        select(models.Soundbite)
        .join(models.Meeting)
        .where(models.Soundbite.id == soundbite_id, models.Meeting.owner_id == user.id)
    )
    if soundbite is None:
        raise HTTPException(status_code=404, detail="Soundbite not found")
    db.delete(soundbite)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
