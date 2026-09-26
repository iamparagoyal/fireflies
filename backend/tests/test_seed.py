import json

from app.database import SessionLocal
from app.seed.loader import SEED_DIR, seed_database


def test_seed_files_are_consistent():
    files = sorted(SEED_DIR.glob("*.json"))
    assert len(files) >= 6
    for path in files:
        data = json.loads(path.read_text())
        names = {p["name"] for p in data["participants"]}
        assert sum(p["is_host"] for p in data["participants"]) == 1, path.name
        assert {s["speaker"] for s in data["transcript"]} <= names, path.name
        starts = [s["start"] for s in data["transcript"]]
        assert starts == sorted(starts), path.name
        assert all(a["assignee"] in names | {None} for a in data["action_items"]), path.name


def test_seed_populates_api(client):
    with SessionLocal() as db:
        assert seed_database(db) == len(list(SEED_DIR.glob("*.json")))
        assert seed_database(db) == 0

    page = client.get("/api/meetings").json()
    assert page["total"] == len(list(SEED_DIR.glob("*.json")))
    first = client.get(f"/api/meetings/{page['items'][0]['id']}").json()
    assert first["summary"]["generated_by"] == "seed"
    assert first["chapters"] and first["action_items"]
    assert any(a["is_completed"] for m in page["items"] for a in client.get(f"/api/meetings/{m['id']}").json()["action_items"])
    assert client.get("/api/search", params={"q": "renewal"}).json()["hits"]
