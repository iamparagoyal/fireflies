from app import models


def _clock(seconds: float) -> str:
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def _duration(seconds: int) -> str:
    minutes = round(seconds / 60)
    return f"{minutes // 60}h {minutes % 60}m" if minutes >= 60 else f"{minutes} min"


def to_markdown(meeting: models.Meeting) -> str:
    lines = [
        f"# {meeting.title}",
        "",
        f"**Date:** {meeting.started_at:%B %d, %Y %H:%M}  ",
        f"**Duration:** {_duration(meeting.duration_seconds)}  ",
        f"**Participants:** {', '.join(p.name for p in meeting.participants) or '—'}",
    ]
    if meeting.tags:
        lines.append(f"**Tags:** {', '.join(t.name for t in meeting.tags)}")

    if meeting.summary:
        lines += ["", "## Overview", "", meeting.summary.overview]
        if meeting.summary.keywords:
            lines += ["", "## Keywords", "", ", ".join(meeting.summary.keywords)]
        if meeting.summary.bullet_points:
            lines += ["", "## Notes", ""] + [f"- {b}" for b in meeting.summary.bullet_points]

    if meeting.action_items:
        lines += ["", "## Action Items", ""]
        for item in meeting.action_items:
            owner = f" — **{item.assignee.name}**" if item.assignee else ""
            due = f" (due {item.due_date:%b %d})" if item.due_date else ""
            lines.append(f"- [{'x' if item.is_completed else ' '}] {item.text}{owner}{due}")

    if meeting.chapters:
        lines += ["", "## Outline", ""]
        for chapter in meeting.chapters:
            lines.append(f"- **{_clock(chapter.start_seconds)} {chapter.title}** — {chapter.summary}")

    if meeting.segments:
        lines += ["", "## Transcript", ""]
        for seg in meeting.segments:
            speaker = seg.speaker.name if seg.speaker else "Unknown"
            lines += [f"**{speaker}** · {_clock(seg.start_seconds)}  ", seg.text, ""]

    return "\n".join(lines).rstrip() + "\n"


def to_text(meeting: models.Meeting) -> str:
    lines = [
        meeting.title,
        f"{meeting.started_at:%B %d, %Y %H:%M} · {_duration(meeting.duration_seconds)}",
        f"Participants: {', '.join(p.name for p in meeting.participants)}",
        "",
    ]
    if meeting.summary:
        lines += ["OVERVIEW", meeting.summary.overview, ""]
    if meeting.action_items:
        lines.append("ACTION ITEMS")
        for item in meeting.action_items:
            owner = f" ({item.assignee.name})" if item.assignee else ""
            lines.append(f"[{'x' if item.is_completed else ' '}] {item.text}{owner}")
        lines.append("")
    lines.append("TRANSCRIPT")
    for seg in meeting.segments:
        speaker = seg.speaker.name if seg.speaker else "Unknown"
        lines.append(f"[{_clock(seg.start_seconds)}] {speaker}: {seg.text}")
    return "\n".join(lines).rstrip() + "\n"
