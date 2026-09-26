from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Platform = Literal["zoom", "google_meet", "teams", "upload"]
Source = Literal["seed", "upload", "paste", "form"]
TranscriptFormat = Literal["auto", "txt", "vtt", "srt", "json"]
SortOrder = Literal["recent", "oldest", "longest", "shortest", "title"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    avatar_color: str


class ParticipantOut(ORMModel):
    id: int
    name: str
    email: str | None


class MeetingParticipantOut(ParticipantOut):
    is_host: bool = False
    talk_time_seconds: float = 0


class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    is_host: bool = False

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name cannot be blank")
        return value


class TagOut(ORMModel):
    id: int
    name: str
    color: str


class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class SegmentOut(ORMModel):
    id: int
    position: int
    start_seconds: float
    end_seconds: float
    text: str
    speaker_id: int | None = Field(validation_alias="participant_id")
    speaker_name: str | None = None
    comment_count: int = 0


class SummaryOut(ORMModel):
    overview: str
    bullet_points: list[str]
    keywords: list[str]
    generated_by: str
    generated_at: datetime


class ChapterOut(ORMModel):
    id: int
    position: int
    title: str
    start_seconds: float
    end_seconds: float
    summary: str


class ActionItemOut(ORMModel):
    id: int
    meeting_id: int
    text: str
    assignee: ParticipantOut | None
    due_date: date | None
    is_completed: bool
    completed_at: datetime | None
    is_ai_generated: bool
    source_segment_id: int | None
    timestamp_seconds: float | None = None
    position: int
    created_at: datetime


class ActionItemWithMeetingOut(ActionItemOut):
    meeting_title: str


class ActionItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    assignee_id: int | None = None
    due_date: date | None = None
    source_segment_id: int | None = None


class ActionItemUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    assignee_id: int | None = None
    due_date: date | None = None
    is_completed: bool | None = None
    position: int | None = None


class SoundbiteOut(ORMModel):
    id: int
    title: str
    start_seconds: float
    end_seconds: float
    created_at: datetime


class SoundbiteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(gt=0)


class CommentOut(ORMModel):
    id: int
    segment_id: int
    body: str
    author: UserOut
    created_at: datetime


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MeetingListItem(ORMModel):
    id: int
    title: str
    started_at: datetime
    duration_seconds: int
    platform: str
    source: str
    participants: list[ParticipantOut]
    tags: list[TagOut]
    overview: str | None = None
    action_item_count: int = 0
    open_action_item_count: int = 0


class MeetingPage(BaseModel):
    items: list[MeetingListItem]
    total: int
    page: int
    page_size: int


class MeetingDetail(ORMModel):
    id: int
    title: str
    started_at: datetime
    duration_seconds: int
    platform: str
    source: str
    media_url: str | None
    owner: UserOut
    participants: list[MeetingParticipantOut]
    tags: list[TagOut]
    summary: SummaryOut | None
    chapters: list[ChapterOut]
    action_items: list[ActionItemOut]
    soundbites: list[SoundbiteOut]
    segment_count: int
    created_at: datetime
    updated_at: datetime


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    started_at: datetime | None = None
    platform: Platform = "upload"
    participants: list[ParticipantIn] = []
    tag_ids: list[int] = []
    transcript: str | None = Field(default=None, max_length=2_000_000)
    transcript_format: TranscriptFormat = "auto"
    duration_seconds: int | None = Field(default=None, ge=0)


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    started_at: datetime | None = None
    platform: Platform | None = None
    participants: list[ParticipantIn] | None = None
    tag_ids: list[int] | None = None


class SearchHit(BaseModel):
    meeting_id: int
    meeting_title: str
    meeting_started_at: datetime
    segment_id: int
    start_seconds: float
    speaker_name: str | None
    snippet: str


class SearchResponse(BaseModel):
    query: str
    meetings: list[MeetingListItem]
    hits: list[SearchHit]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class Citation(BaseModel):
    segment_id: int
    start_seconds: float
    speaker_name: str | None
    text: str


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    generated_by: str


class AppInfo(BaseModel):
    user: UserOut
    llm_enabled: bool
    llm_model: str | None
