TRANSCRIPT = """[00:00:00] Dana Lee: Thanks for joining, today we need to finalize the pricing page and the launch timeline.
[00:00:08] Sam Ortiz: The pricing page draft is ready. The enterprise tier is still missing the SSO line item.
[00:00:16] Dana Lee: Okay. Sam, can you add the SSO line item to the enterprise tier by Friday?
[00:00:22] Sam Ortiz: Yes, I'll update the pricing page and send it for review by Friday.
[00:00:30] Dana Lee: Great. For the launch timeline, I will draft the announcement email tomorrow.
[00:00:40] Sam Ortiz: The launch timeline depends on the pricing page, so let's review both next week.
"""


def _create(client, **overrides):
    payload = {
        "title": "Pricing sync",
        "participants": [{"name": "Dana Lee", "email": "dana@example.com", "is_host": True}],
        "transcript": TRANSCRIPT,
    } | overrides
    response = client.post("/api/meetings", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_meeting_from_pasted_transcript(client):
    meeting = _create(client)
    names = {p["name"] for p in meeting["participants"]}
    assert names == {"Dana Lee", "Sam Ortiz"}
    assert meeting["source"] == "paste"
    assert meeting["segment_count"] == 6
    assert meeting["summary"]["generated_by"] == "heuristic"
    assert meeting["summary"]["keywords"]
    assert meeting["chapters"]
    texts = " ".join(a["text"].lower() for a in meeting["action_items"])
    assert "pricing page" in texts
    assigned = {a["assignee"]["name"] for a in meeting["action_items"] if a["assignee"]}
    assert "Sam Ortiz" in assigned


def test_list_filter_search_and_sort(client):
    _create(client, title="Alpha review", started_at="2026-01-01T10:00:00")
    _create(client, title="Beta planning", started_at="2026-02-01T10:00:00")

    items = client.get("/api/meetings").json()["items"]
    assert [m["title"] for m in items] == ["Beta planning", "Alpha review"]

    oldest = client.get("/api/meetings", params={"sort": "oldest"}).json()["items"]
    assert oldest[0]["title"] == "Alpha review"

    assert client.get("/api/meetings", params={"q": "alpha"}).json()["total"] == 1
    assert client.get("/api/meetings", params={"q": "sam ortiz"}).json()["total"] == 2
    assert client.get("/api/meetings", params={"date_from": "2026-01-15T00:00:00"}).json()["total"] == 1


def test_update_and_delete_meeting(client):
    meeting = _create(client)
    tag = client.post("/api/tags", json={"name": "Launch"}).json()
    updated = client.patch(
        f"/api/meetings/{meeting['id']}",
        json={"title": "Renamed", "participants": [{"name": "Dana Lee"}, {"name": "New Person"}], "tag_ids": [tag["id"]]},
    ).json()
    assert updated["title"] == "Renamed"
    assert [p["name"] for p in updated["participants"]] == ["Dana Lee", "New Person"]
    assert updated["tags"][0]["name"] == "Launch"

    assert client.delete(f"/api/meetings/{meeting['id']}").status_code == 204
    assert client.get(f"/api/meetings/{meeting['id']}").status_code == 404


def test_action_item_crud(client):
    meeting = _create(client)
    sam = next(p for p in meeting["participants"] if p["name"] == "Sam Ortiz")
    created = client.post(
        f"/api/meetings/{meeting['id']}/action-items", json={"text": "Book a room", "assignee_id": sam["id"]}
    ).json()
    assert created["assignee"]["name"] == "Sam Ortiz" and not created["is_ai_generated"]

    done = client.patch(f"/api/action-items/{created['id']}", json={"is_completed": True, "text": "Book room 4"}).json()
    assert done["is_completed"] and done["completed_at"] and done["text"] == "Book room 4"

    unassigned = client.patch(f"/api/action-items/{created['id']}", json={"assignee_id": None}).json()
    assert unassigned["assignee"] is None

    assert client.get("/api/action-items", params={"completed": True}).json()[0]["meeting_title"] == "Pricing sync"
    assert client.delete(f"/api/action-items/{created['id']}").status_code == 204


def test_regenerate_keeps_manual_action_items(client):
    meeting = _create(client)
    client.post(f"/api/meetings/{meeting['id']}/action-items", json={"text": "Manual task"})
    regenerated = client.post(f"/api/meetings/{meeting['id']}/regenerate").json()
    assert "Manual task" in [a["text"] for a in regenerated["action_items"]]


def test_transcript_comments_and_search(client):
    meeting = _create(client)
    segments = client.get(f"/api/meetings/{meeting['id']}/transcript").json()
    assert segments[0]["speaker_name"] == "Dana Lee"

    comment = client.post(f"/api/segments/{segments[1]['id']}/comments", json={"body": "Important"})
    assert comment.status_code == 201
    assert client.get(f"/api/meetings/{meeting['id']}/transcript").json()[1]["comment_count"] == 1

    results = client.get("/api/search", params={"q": "enterprise"}).json()
    assert segments[1]["id"] in {hit["segment_id"] for hit in results["hits"]}
    assert all("\x02" in hit["snippet"] for hit in results["hits"])


def test_upload_vtt_file(client):
    vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Ana>We will ship on Monday.\n"
    response = client.post(
        "/api/meetings/upload", files={"file": ("standup-notes.vtt", vtt, "text/vtt")}, data={"participants": "Ana, Ben"}
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "standup notes"
    assert body["source"] == "upload"
    assert {p["name"] for p in body["participants"]} == {"Ana", "Ben"}


def test_ask_and_export(client):
    meeting = _create(client)
    answer = client.post(f"/api/meetings/{meeting['id']}/ask", json={"question": "What about SSO?"}).json()
    assert answer["citations"]
    exported = client.get(f"/api/meetings/{meeting['id']}/export", params={"format": "md"})
    assert exported.headers["content-disposition"].endswith('.md"')
    assert "## Transcript" in exported.text


def test_soundbites(client):
    meeting = _create(client)
    bite = client.post(
        f"/api/meetings/{meeting['id']}/soundbites", json={"title": "Pricing", "start_seconds": 8, "end_seconds": 20}
    )
    assert bite.status_code == 201
    assert client.get(f"/api/meetings/{meeting['id']}").json()["soundbites"][0]["title"] == "Pricing"
    bad = client.post(
        f"/api/meetings/{meeting['id']}/soundbites", json={"title": "x", "start_seconds": 10, "end_seconds": 5}
    )
    assert bad.status_code == 422
