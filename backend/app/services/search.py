from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models, schemas
from app.fts import to_match_query

_SEARCH_SQL = text(
    """
    SELECT s.id AS segment_id, s.meeting_id, s.start_seconds, m.title, m.started_at, p.name AS speaker_name,
           snippet(transcript_segments_fts, 0, char(2), char(3), '…', 18) AS snippet
    FROM transcript_segments_fts
    JOIN transcript_segments s ON s.id = transcript_segments_fts.rowid
    JOIN meetings m ON m.id = s.meeting_id
    LEFT JOIN participants p ON p.id = s.participant_id
    WHERE transcript_segments_fts MATCH :query AND m.owner_id = :owner_id
    ORDER BY bm25(transcript_segments_fts), m.started_at DESC
    LIMIT :limit
    """
)


def search_transcripts(db: Session, owner: models.User, q: str, limit: int = 40) -> list[schemas.SearchHit]:
    match = to_match_query(q)
    if not match:
        return []
    rows = db.execute(_SEARCH_SQL, {"query": match, "owner_id": owner.id, "limit": limit}).mappings()
    return [
        schemas.SearchHit(
            meeting_id=row["meeting_id"],
            meeting_title=row["title"],
            meeting_started_at=row["started_at"],
            segment_id=row["segment_id"],
            start_seconds=row["start_seconds"],
            speaker_name=row["speaker_name"],
            snippet=row["snippet"],
        )
        for row in rows
    ]
