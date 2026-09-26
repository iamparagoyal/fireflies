import os
import tempfile

import pytest

_db_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_db_dir}/test.db"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ.pop("ANTHROPIC_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.fts import install_fts  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE IF EXISTS transcript_segments_fts")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    install_fts(engine)
    with TestClient(app) as test_client:
        yield test_client
