from collections import defaultdict
from datetime import datetime

from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.models import utcnow
from app.services.notes_generator import GeneratedNotes, SegmentInput, generate_notes
from app.services.transcript_parser import ParsedSegment

TAG_PALETTE = ["#7C5CFC", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#6366F1", "#14B8A6"]


def get_current_user(db: Session) -> models.User:
    user = db.scalar(select(models.User).order_by(models.User.id).limit(1))
    if user is None:
        user = models.User(name="Alex Morgan", email="alex.morgan@northwindlabs.io", avatar_color="#7C5CFC")
        db.add(user)
        db.commit()
    return user


def upsert_participant(db: Session, name: str, email: str | None = None) -> models.Participant:
    name = name.strip()
    participant = None
    if email:
        participant = db.scalar(select(models.Participant).where(func.lower(models.Participant.email) == email.lower()))
    if participant is None:
        participant = db.scalar(
            select(models.Participant).where(func.lower(models.Participant.name) == name.lower()).limit(1)
        )
    if participant is None:
        participant = models.Participant(name=name, email=email)
        db.add(participant)
        db.flush()
    elif email and not participant.email:
        participant.email = email
    return participant


def set_participants(db: Session, meeting: models.Meeting, people: list[schemas.ParticipantIn]) -> None:
    resolved = [(upsert_participant(db, person.name, person.email), person.is_host) for person in people]
    existing = {link.participant_id: link for link in meeting.participant_links}
    links: list[models.MeetingParticipant] = []
    seen: set[int] = set()
    for participant, is_host in resolved:
        if participant.id in seen:
            continue
        seen.add(participant.id)
        link = existing.get(participant.id) or models.MeetingParticipant(participant=participant)
        link.is_host = is_host
        link.position = len(links)
        links.append(link)
    meeting.participant_links = links


def set_tags(db: Session, meeting: models.Meeting, tag_ids: list[int]) -> None:
    meeting.tags = list(db.scalars(select(models.Tag).where(models.Tag.id.in_(tag_ids)))) if tag_ids else []


def get_or_create_tag(db: Session, name: str, color: str | None = None) -> models.Tag:
    tag = db.scalar(select(models.Tag).where(func.lower(models.Tag.name) == name.strip().lower()))
    if tag is None:
        count = db.scalar(select(func.count(models.Tag.id))) or 0
        tag = models.Tag(name=name.strip(), color=color or TAG_PALETTE[count % len(TAG_PALETTE)])
        db.add(tag)
        db.flush()
    return tag


def add_segments(db: Session, meeting: models.Meeting, parsed: list[ParsedSegment]) -> None:
    speakers: dict[str, models.Participant] = {}
    for link in meeting.participant_links:
        speakers[link.participant.name.lower()] = link.participant

    people = [
        schemas.ParticipantIn(name=l.participant.name, email=l.participant.email, is_host=l.is_host)
        for l in meeting.participant_links
    ]
    for seg in parsed:
        if seg.speaker and seg.speaker.lower() not in speakers:
            people.append(schemas.ParticipantIn(name=seg.speaker))
            speakers[seg.speaker.lower()] = None
    if len(people) != len(meeting.participant_links):
        set_participants(db, meeting, people)
        db.flush()
        speakers = {l.participant.name.lower(): l.participant for l in meeting.participant_links}

    meeting.segments = [
        models.TranscriptSegment(
            position=i,
            start_seconds=round(seg.start, 2),
            end_seconds=round(max(seg.end, seg.start), 2),
            text=seg.text,
            speaker=speakers.get(seg.speaker.lower()) if seg.speaker else None,
        )
        for i, seg in enumerate(parsed)
    ]
    if parsed:
        meeting.duration_seconds = max(meeting.duration_seconds or 0, int(round(parsed[-1].end)))
    db.flush()


def _segment_inputs(meeting: models.Meeting) -> list[SegmentInput]:
    return [
        SegmentInput(s.speaker.name if s.speaker else None, s.start_seconds, s.end_seconds, s.text)
        for s in meeting.segments
    ]


def _segment_at(meeting: models.Meeting, seconds: float | None) -> models.TranscriptSegment | None:
    if seconds is None or not meeting.segments:
        return None
    candidate = meeting.segments[0]
    for seg in meeting.segments:
        if seg.start_seconds <= seconds + 0.5:
            candidate = seg
        else:
            break
    return candidate


def apply_notes(db: Session, meeting: models.Meeting, notes: GeneratedNotes) -> None:
    by_name = {l.participant.name.lower(): l.participant for l in meeting.participant_links}
    by_first = {l.participant.name.split()[0].lower(): l.participant for l in meeting.participant_links}

    def resolve(name: str | None) -> models.Participant | None:
        if not name:
            return None
        key = name.strip().lower()
        return by_name.get(key) or by_first.get(key.split()[0] if key else "")

    if meeting.summary is None:
        meeting.summary = models.Summary()
    meeting.summary.overview = notes.overview
    meeting.summary.bullet_points = notes.bullet_points
    meeting.summary.keywords = notes.keywords
    meeting.summary.generated_by = notes.generated_by
    meeting.summary.generated_at = utcnow()

    meeting.chapters = []
    db.flush()
    meeting.chapters = [
        models.Chapter(position=i, title=c.title, start_seconds=c.start, end_seconds=c.end, summary=c.summary)
        for i, c in enumerate(sorted(notes.chapters, key=lambda c: c.start))
    ]

    manual = [a for a in meeting.action_items if not a.is_ai_generated]
    generated = []
    for item in notes.action_items:
        segment = _segment_at(meeting, item.timestamp)
        assignee = resolve(item.assignee)
        generated.append(
            models.ActionItem(
                text=item.text,
                assignee_id=assignee.id if assignee else None,
                source_segment_id=segment.id if segment else None,
                due_date=item.due_date,
                is_ai_generated=True,
            )
        )
    meeting.action_items = generated + manual
    for position, action in enumerate(meeting.action_items):
        action.position = position
    db.flush()


def regenerate_notes(db: Session, meeting: models.Meeting) -> None:
    participants = [l.participant.name for l in meeting.participant_links]
    notes = generate_notes(_segment_inputs(meeting), participants, meeting.started_at.date())
    apply_notes(db, meeting, notes)


def create_meeting(
    db: Session,
    owner: models.User,
    data: schemas.MeetingCreate,
    parsed: list[ParsedSegment] | None,
    source: str,
) -> models.Meeting:
    meeting = models.Meeting(
        owner=owner,
        title=data.title.strip(),
        started_at=(data.started_at.replace(tzinfo=None) if data.started_at else utcnow()),
        platform=data.platform,
        source=source,
        duration_seconds=data.duration_seconds or 0,
    )
    db.add(meeting)
    set_participants(db, meeting, data.participants)
    set_tags(db, meeting, data.tag_ids)
    db.flush()
    if parsed:
        add_segments(db, meeting, parsed)
        regenerate_notes(db, meeting)
    db.commit()
    return meeting


def meeting_query() -> Select:
    return select(models.Meeting).options(
        selectinload(models.Meeting.participant_links).selectinload(models.MeetingParticipant.participant),
        selectinload(models.Meeting.tags),
        selectinload(models.Meeting.summary),
    )


def load_meeting_detail(db: Session, meeting_id: int) -> models.Meeting | None:
    return db.scalar(
        meeting_query()
        .where(models.Meeting.id == meeting_id)
        .options(
            selectinload(models.Meeting.owner),
            selectinload(models.Meeting.segments).selectinload(models.TranscriptSegment.speaker),
            selectinload(models.Meeting.chapters),
            selectinload(models.Meeting.soundbites),
            selectinload(models.Meeting.action_items).selectinload(models.ActionItem.assignee),
            selectinload(models.Meeting.action_items).selectinload(models.ActionItem.source_segment),
        )
    )


def list_meetings(
    db: Session,
    owner: models.User,
    q: str | None,
    participant_ids: list[int],
    tag_ids: list[int],
    date_from: datetime | None,
    date_to: datetime | None,
    sort: schemas.SortOrder,
    page: int,
    page_size: int,
) -> tuple[list[models.Meeting], int]:
    conditions = [models.Meeting.owner_id == owner.id]
    if q:
        like = f"%{q.strip().lower()}%"
        participant_match = (
            select(models.MeetingParticipant.meeting_id)
            .join(models.Participant)
            .where(or_(func.lower(models.Participant.name).like(like), func.lower(models.Participant.email).like(like)))
        )
        conditions.append(or_(func.lower(models.Meeting.title).like(like), models.Meeting.id.in_(participant_match)))
    for participant_id in participant_ids:
        conditions.append(
            models.Meeting.id.in_(
                select(models.MeetingParticipant.meeting_id).where(
                    models.MeetingParticipant.participant_id == participant_id
                )
            )
        )
    if tag_ids:
        conditions.append(
            models.Meeting.id.in_(select(models.meeting_tags.c.meeting_id).where(models.meeting_tags.c.tag_id.in_(tag_ids)))
        )
    if date_from:
        conditions.append(models.Meeting.started_at >= date_from)
    if date_to:
        conditions.append(models.Meeting.started_at <= date_to)

    order = {
        "recent": models.Meeting.started_at.desc(),
        "oldest": models.Meeting.started_at.asc(),
        "longest": models.Meeting.duration_seconds.desc(),
        "shortest": models.Meeting.duration_seconds.asc(),
        "title": func.lower(models.Meeting.title).asc(),
    }[sort]

    where = and_(*conditions)
    total = db.scalar(select(func.count()).select_from(models.Meeting).where(where)) or 0
    meetings = list(
        db.scalars(meeting_query().where(where).order_by(order, models.Meeting.id.desc()).offset((page - 1) * page_size).limit(page_size))
    )
    return meetings, total


def action_item_counts(db: Session, meeting_ids: list[int]) -> dict[int, tuple[int, int]]:
    if not meeting_ids:
        return {}
    rows = db.execute(
        select(
            models.ActionItem.meeting_id,
            func.count(models.ActionItem.id),
            func.sum(case((models.ActionItem.is_completed, 0), else_=1)),
        )
        .where(models.ActionItem.meeting_id.in_(meeting_ids))
        .group_by(models.ActionItem.meeting_id)
    )
    return {meeting_id: (total, int(open_ or 0)) for meeting_id, total, open_ in rows}


def to_list_item(meeting: models.Meeting, counts: tuple[int, int] = (0, 0)) -> schemas.MeetingListItem:
    return schemas.MeetingListItem(
        id=meeting.id,
        title=meeting.title,
        started_at=meeting.started_at,
        duration_seconds=meeting.duration_seconds,
        platform=meeting.platform,
        source=meeting.source,
        participants=[schemas.ParticipantOut.model_validate(p) for p in meeting.participants],
        tags=[schemas.TagOut.model_validate(t) for t in meeting.tags],
        overview=meeting.summary.overview if meeting.summary else None,
        action_item_count=counts[0],
        open_action_item_count=counts[1],
    )


def to_action_item(item: models.ActionItem) -> schemas.ActionItemOut:
    return schemas.ActionItemOut(
        id=item.id,
        meeting_id=item.meeting_id,
        text=item.text,
        assignee=schemas.ParticipantOut.model_validate(item.assignee) if item.assignee else None,
        due_date=item.due_date,
        is_completed=item.is_completed,
        completed_at=item.completed_at,
        is_ai_generated=item.is_ai_generated,
        source_segment_id=item.source_segment_id,
        timestamp_seconds=item.source_segment.start_seconds if item.source_segment else None,
        position=item.position,
        created_at=item.created_at,
    )


def to_detail(meeting: models.Meeting) -> schemas.MeetingDetail:
    talk_time: dict[int, float] = defaultdict(float)
    for seg in meeting.segments:
        if seg.participant_id:
            talk_time[seg.participant_id] += seg.end_seconds - seg.start_seconds

    return schemas.MeetingDetail(
        id=meeting.id,
        title=meeting.title,
        started_at=meeting.started_at,
        duration_seconds=meeting.duration_seconds,
        platform=meeting.platform,
        source=meeting.source,
        media_url=meeting.media_url,
        owner=schemas.UserOut.model_validate(meeting.owner),
        participants=[
            schemas.MeetingParticipantOut(
                id=l.participant.id,
                name=l.participant.name,
                email=l.participant.email,
                is_host=l.is_host,
                talk_time_seconds=round(talk_time.get(l.participant_id, 0.0), 1),
            )
            for l in meeting.participant_links
        ],
        tags=[schemas.TagOut.model_validate(t) for t in meeting.tags],
        summary=schemas.SummaryOut.model_validate(meeting.summary) if meeting.summary else None,
        chapters=[schemas.ChapterOut.model_validate(c) for c in meeting.chapters],
        action_items=[to_action_item(a) for a in meeting.action_items],
        soundbites=[schemas.SoundbiteOut.model_validate(s) for s in meeting.soundbites],
        segment_count=len(meeting.segments),
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
    )


def to_segments(db: Session, meeting: models.Meeting) -> list[schemas.SegmentOut]:
    ids = [s.id for s in meeting.segments]
    comment_counts = dict(
        db.execute(
            select(models.Comment.segment_id, func.count(models.Comment.id))
            .where(models.Comment.segment_id.in_(ids))
            .group_by(models.Comment.segment_id)
        ).all()
    ) if ids else {}
    return [
        schemas.SegmentOut(
            id=s.id,
            position=s.position,
            start_seconds=s.start_seconds,
            end_seconds=s.end_seconds,
            text=s.text,
            participant_id=s.participant_id,
            speaker_name=s.speaker.name if s.speaker else None,
            comment_count=comment_counts.get(s.id, 0),
        )
        for s in meeting.segments
    ]
