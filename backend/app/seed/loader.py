import json
from datetime import datetime, time, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.models import utcnow
from app.services.meetings import add_segments, apply_notes, get_current_user, get_or_create_tag, set_participants
from app.services.notes_generator import GeneratedActionItem, GeneratedChapter, GeneratedNotes
from app.services.transcript_parser import ParsedSegment

SEED_DIR = Path(__file__).parent / "meetings"

TAG_COLORS = {
    "Product": "#7C5CFC",
    "Sales": "#10B981",
    "Customer": "#0EA5E9",
    "Engineering": "#6366F1",
    "Planning": "#F59E0B",
    "Hiring": "#EC4899",
    "Marketing": "#F97316",
    "Onboarding": "#14B8A6",
    "Design": "#A855F7",
    "Leadership": "#EF4444",
    "Finance": "#22C55E",
    "Internal": "#64748B",
}


def _load_one(db: Session, owner: models.User, data: dict) -> models.Meeting:
    hour, minute = (int(x) for x in data.get("start_time", "10:00").split(":"))
    started_at = datetime.combine(utcnow().date() - timedelta(days=data.get("days_ago", 0)), time(hour, minute))

    meeting = models.Meeting(
        owner=owner,
        title=data["title"],
        started_at=started_at,
        platform=data.get("platform", "zoom"),
        source="seed",
    )
    db.add(meeting)
    set_participants(db, meeting, [schemas.ParticipantIn(**p) for p in data.get("participants", [])])
    meeting.tags = [get_or_create_tag(db, name, TAG_COLORS.get(name)) for name in data.get("tags", [])]
    db.flush()

    add_segments(
        db,
        meeting,
        [ParsedSegment(s.get("speaker"), float(s["start"]), float(s["end"]), s["text"]) for s in data.get("transcript", [])],
    )

    summary = data.get("summary", {})
    apply_notes(
        db,
        meeting,
        GeneratedNotes(
            overview=summary.get("overview", ""),
            bullet_points=summary.get("bullet_points", []),
            keywords=summary.get("keywords", []),
            chapters=[GeneratedChapter(c["title"], c["start"], c["end"], c.get("summary", "")) for c in data.get("chapters", [])],
            action_items=[
                GeneratedActionItem(
                    text=a["text"],
                    assignee=a.get("assignee"),
                    timestamp=a.get("timestamp"),
                    due_date=started_at.date() + timedelta(days=a["due_in_days"]) if a.get("due_in_days") is not None else None,
                )
                for a in data.get("action_items", [])
            ],
            generated_by="seed",
        ),
    )
    for item, raw in zip(meeting.action_items, data.get("action_items", [])):
        if raw.get("completed"):
            item.is_completed = True
            item.completed_at = started_at + timedelta(days=1)
    return meeting


def seed_database(db: Session, force: bool = False) -> int:
    if not force and (db.scalar(select(func.count(models.Meeting.id))) or 0) > 0:
        return 0
    owner = get_current_user(db)
    files = sorted(SEED_DIR.glob("*.json"))
    for path in files:
        _load_one(db, owner, json.loads(path.read_text()))
    db.commit()
    return len(files)
