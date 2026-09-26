from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services.meetings import get_current_user, load_meeting_detail

DbSession = Annotated[Session, Depends(get_db)]


def current_user(db: DbSession) -> models.User:
    return get_current_user(db)


CurrentUser = Annotated[models.User, Depends(current_user)]


def get_owned_meeting(db: Session, user: models.User, meeting_id: int) -> models.Meeting:
    meeting = load_meeting_detail(db, meeting_id)
    if meeting is None or meeting.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting
