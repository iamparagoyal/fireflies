from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app import models, schemas
from app.deps import CurrentUser, DbSession, get_owned_meeting
from app.models import utcnow
from app.services.meetings import to_action_item

router = APIRouter(prefix="/api", tags=["action items"])


def _get_owned_item(db: DbSession, user: models.User, item_id: int) -> models.ActionItem:
    item = db.scalar(
        select(models.ActionItem)
        .join(models.Meeting)
        .where(models.ActionItem.id == item_id, models.Meeting.owner_id == user.id)
        .options(selectinload(models.ActionItem.assignee), selectinload(models.ActionItem.source_segment))
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Action item not found")
    return item


def _validate_refs(meeting: models.Meeting, assignee_id: int | None, segment_id: int | None) -> None:
    if assignee_id is not None and assignee_id not in {p.id for p in meeting.participants}:
        raise HTTPException(status_code=422, detail="Assignee must be a participant of this meeting")
    if segment_id is not None and segment_id not in {s.id for s in meeting.segments}:
        raise HTTPException(status_code=422, detail="Segment does not belong to this meeting")


@router.get("/action-items", response_model=list[schemas.ActionItemWithMeetingOut])
def list_all_action_items(
    db: DbSession,
    user: CurrentUser,
    completed: bool | None = None,
    assignee_id: Annotated[int | None, Query()] = None,
):
    query = (
        select(models.ActionItem, models.Meeting.title)
        .join(models.Meeting)
        .where(models.Meeting.owner_id == user.id)
        .options(selectinload(models.ActionItem.assignee), selectinload(models.ActionItem.source_segment))
        .order_by(models.ActionItem.is_completed, models.Meeting.started_at.desc(), models.ActionItem.position)
    )
    if completed is not None:
        query = query.where(models.ActionItem.is_completed == completed)
    if assignee_id is not None:
        query = query.where(models.ActionItem.assignee_id == assignee_id)
    return [
        schemas.ActionItemWithMeetingOut(**to_action_item(item).model_dump(), meeting_title=title)
        for item, title in db.execute(query).all()
    ]


@router.get("/meetings/{meeting_id}/action-items", response_model=list[schemas.ActionItemOut])
def list_action_items(meeting_id: int, db: DbSession, user: CurrentUser):
    return [to_action_item(a) for a in get_owned_meeting(db, user, meeting_id).action_items]


@router.post(
    "/meetings/{meeting_id}/action-items", response_model=schemas.ActionItemOut, status_code=status.HTTP_201_CREATED
)
def create_action_item(meeting_id: int, payload: schemas.ActionItemCreate, db: DbSession, user: CurrentUser):
    meeting = get_owned_meeting(db, user, meeting_id)
    _validate_refs(meeting, payload.assignee_id, payload.source_segment_id)
    next_position = (db.scalar(select(func.max(models.ActionItem.position)).where(models.ActionItem.meeting_id == meeting.id)) or -1) + 1
    item = models.ActionItem(
        meeting_id=meeting.id,
        text=payload.text.strip(),
        assignee_id=payload.assignee_id,
        due_date=payload.due_date,
        source_segment_id=payload.source_segment_id,
        position=next_position,
    )
    db.add(item)
    db.commit()
    return to_action_item(_get_owned_item(db, user, item.id))


@router.patch("/action-items/{item_id}", response_model=schemas.ActionItemOut)
def update_action_item(item_id: int, payload: schemas.ActionItemUpdate, db: DbSession, user: CurrentUser):
    item = _get_owned_item(db, user, item_id)
    fields = payload.model_fields_set

    if "assignee_id" in fields:
        _validate_refs(get_owned_meeting(db, user, item.meeting_id), payload.assignee_id, None)
        item.assignee_id = payload.assignee_id
    if "text" in fields and payload.text is not None:
        item.text = payload.text.strip()
    if "due_date" in fields:
        item.due_date = payload.due_date
    if "position" in fields and payload.position is not None:
        item.position = payload.position
    if "is_completed" in fields and payload.is_completed is not None and payload.is_completed != item.is_completed:
        item.is_completed = payload.is_completed
        item.completed_at = utcnow() if payload.is_completed else None

    db.commit()
    db.expire_all()
    return to_action_item(_get_owned_item(db, user, item_id))


@router.delete("/action-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_item(item_id: int, db: DbSession, user: CurrentUser):
    db.delete(_get_owned_item(db, user, item_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
