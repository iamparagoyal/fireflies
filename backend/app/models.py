from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


meeting_tags = Table(
    "meeting_tags",
    Base.metadata,
    Column("meeting_id", ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    avatar_color: Mapped[str] = mapped_column(String(7), default="#7C5CFC")

    meetings: Mapped[list["Meeting"]] = relationship(back_populates="owner")


class Participant(TimestampMixin, Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)

    meeting_links: Mapped[list["MeetingParticipant"]] = relationship(back_populates="participant")


class Meeting(TimestampMixin, Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("duration_seconds >= 0", name="ck_meetings_duration_non_negative"),
        Index("ix_meetings_owner_started", "owner_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    platform: Mapped[str] = mapped_column(String(20), default="upload")
    source: Mapped[str] = mapped_column(String(20), default="form")
    media_url: Mapped[str | None] = mapped_column(String(500))

    owner: Mapped[User] = relationship(back_populates="meetings")
    participant_links: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="MeetingParticipant.position"
    )
    segments: Mapped[list["TranscriptSegment"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="TranscriptSegment.position"
    )
    summary: Mapped["Summary | None"] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", uselist=False
    )
    chapters: Mapped[list["Chapter"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="Chapter.position"
    )
    action_items: Mapped[list["ActionItem"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="ActionItem.position"
    )
    soundbites: Mapped[list["Soundbite"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="Soundbite.start_seconds"
    )
    tags: Mapped[list["Tag"]] = relationship(secondary=meeting_tags, back_populates="meetings", order_by="Tag.name")

    @property
    def participants(self) -> list[Participant]:
        return [link.participant for link in self.participant_links]


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), primary_key=True)
    is_host: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    meeting: Mapped[Meeting] = relationship(back_populates="participant_links")
    participant: Mapped[Participant] = relationship(back_populates="meeting_links")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    __table_args__ = (
        UniqueConstraint("meeting_id", "position", name="uq_segments_meeting_position"),
        CheckConstraint("end_seconds >= start_seconds", name="ck_segments_time_order"),
        Index("ix_segments_meeting_start", "meeting_id", "start_seconds"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    participant_id: Mapped[int | None] = mapped_column(ForeignKey("participants.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer)
    start_seconds: Mapped[float] = mapped_column(Float)
    end_seconds: Mapped[float] = mapped_column(Float)
    text: Mapped[str] = mapped_column(Text)

    meeting: Mapped[Meeting] = relationship(back_populates="segments")
    speaker: Mapped[Participant | None] = relationship()
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="segment", cascade="all, delete-orphan", order_by="Comment.created_at"
    )


class Summary(Base):
    __tablename__ = "summaries"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    overview: Mapped[str] = mapped_column(Text, default="")
    bullet_points: Mapped[list[str]] = mapped_column(JSON, default=list)
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    generated_by: Mapped[str] = mapped_column(String(60), default="heuristic")
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="summary")


class Chapter(Base):
    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("meeting_id", "position", name="uq_chapters_meeting_position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    start_seconds: Mapped[float] = mapped_column(Float)
    end_seconds: Mapped[float] = mapped_column(Float)
    summary: Mapped[str] = mapped_column(Text, default="")

    meeting: Mapped[Meeting] = relationship(back_populates="chapters")


class ActionItem(TimestampMixin, Base):
    __tablename__ = "action_items"
    __table_args__ = (Index("ix_action_items_meeting_position", "meeting_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("participants.id", ondelete="SET NULL"))
    source_segment_id: Mapped[int | None] = mapped_column(ForeignKey("transcript_segments.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)

    meeting: Mapped[Meeting] = relationship(back_populates="action_items")
    assignee: Mapped[Participant | None] = relationship()
    source_segment: Mapped[TranscriptSegment | None] = relationship()


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    color: Mapped[str] = mapped_column(String(7), default="#7C5CFC")

    meetings: Mapped[list[Meeting]] = relationship(secondary=meeting_tags, back_populates="tags")


class Comment(TimestampMixin, Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("transcript_segments.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)

    segment: Mapped[TranscriptSegment] = relationship(back_populates="comments")
    author: Mapped[User] = relationship()


class Soundbite(TimestampMixin, Base):
    __tablename__ = "soundbites"
    __table_args__ = (CheckConstraint("end_seconds > start_seconds", name="ck_soundbites_time_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    start_seconds: Mapped[float] = mapped_column(Float)
    end_seconds: Mapped[float] = mapped_column(Float)

    meeting: Mapped[Meeting] = relationship(back_populates="soundbites")
