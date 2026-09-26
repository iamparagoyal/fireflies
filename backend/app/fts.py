from sqlalchemy import text
from sqlalchemy.engine import Engine

FTS_DDL = [
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS transcript_segments_fts USING fts5(
        text,
        content='transcript_segments',
        content_rowid='id',
        tokenize='porter unicode61'
    )
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_ai AFTER INSERT ON transcript_segments BEGIN
        INSERT INTO transcript_segments_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_ad AFTER DELETE ON transcript_segments BEGIN
        INSERT INTO transcript_segments_fts(transcript_segments_fts, rowid, text) VALUES ('delete', old.id, old.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_au AFTER UPDATE OF text ON transcript_segments BEGIN
        INSERT INTO transcript_segments_fts(transcript_segments_fts, rowid, text) VALUES ('delete', old.id, old.text);
        INSERT INTO transcript_segments_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
]


def install_fts(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as conn:
        for statement in FTS_DDL:
            conn.execute(text(statement))


def to_match_query(raw: str) -> str:
    terms = [t for t in "".join(c if c.isalnum() else " " for c in raw).split() if t]
    return " ".join(f'"{t}"*' for t in terms)
