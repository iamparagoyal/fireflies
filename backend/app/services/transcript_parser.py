import json
import re
from dataclasses import dataclass

WORDS_PER_SECOND = 2.5
MIN_SEGMENT_SECONDS = 1.5


class TranscriptParseError(ValueError):
    pass


@dataclass
class ParsedSegment:
    speaker: str | None
    start: float
    end: float
    text: str


_TIMESTAMP = r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?"
_CUE_TIMING = re.compile(rf"^\s*{_TIMESTAMP}\s*-->\s*{_TIMESTAMP}")
_VTT_VOICE = re.compile(r"^<v(?:\.[^\s>]+)*\s+([^>]+)>(.*?)(?:</v>)?$")
_SPEAKER_PREFIX = re.compile(r"^([A-Z][\w.'\- ]{0,60}?):\s+(.+)$")
_TXT_BRACKETED = re.compile(rf"^\[?\(?{_TIMESTAMP}\)?\]?\s*[-–]?\s*(.+)$")
_TXT_SPEAKER_THEN_TIME = re.compile(rf"^([A-Z][\w.'\- ]{{0,60}}?)\s*[\(\[]{_TIMESTAMP}[\)\]]\s*:?\s*(.*)$")
_TAG = re.compile(r"<[^>]+>")


def _to_seconds(h: str | None, m: str, s: str, frac: str | None) -> float:
    seconds = int(h or 0) * 3600 + int(m) * 60 + int(s)
    if frac:
        seconds += int(frac.ljust(3, "0")[:3]) / 1000
    return float(seconds)


def _estimate_duration(text: str) -> float:
    return max(MIN_SEGMENT_SECONDS, round(len(text.split()) / WORDS_PER_SECOND, 2))


def _split_speaker(text: str) -> tuple[str | None, str]:
    match = _SPEAKER_PREFIX.match(text.strip())
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return None, text.strip()


def detect_format(content: str, filename: str | None = None) -> str:
    if filename:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext in {"vtt", "srt", "json", "txt"}:
            return ext
    stripped = content.lstrip()
    if stripped.startswith("WEBVTT"):
        return "vtt"
    if stripped.startswith(("[", "{")):
        try:
            json.loads(stripped)
            return "json"
        except json.JSONDecodeError:
            pass
    if any(_CUE_TIMING.match(line) for line in content.split("\n")[:20]):
        return "srt"
    return "txt"


def parse_transcript(content: str, fmt: str = "auto", filename: str | None = None) -> list[ParsedSegment]:
    content = content.replace("\r\n", "\n").replace("﻿", "").strip()
    if not content:
        raise TranscriptParseError("Transcript is empty")

    if fmt == "auto":
        fmt = detect_format(content, filename)

    parsers = {"vtt": _parse_cues, "srt": _parse_cues, "json": _parse_json, "txt": _parse_txt}
    segments = parsers[fmt](content)
    segments = _merge_consecutive(_normalize(segments))
    if not segments:
        raise TranscriptParseError("No transcript lines could be parsed")
    return segments


def _parse_cues(content: str) -> list[ParsedSegment]:
    segments: list[ParsedSegment] = []
    for block in re.split(r"\n\s*\n", content):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        timing_index = next((i for i, line in enumerate(lines) if _CUE_TIMING.match(line)), None)
        if timing_index is None:
            continue
        g = _CUE_TIMING.match(lines[timing_index]).groups()
        start, end = _to_seconds(*g[0:4]), _to_seconds(*g[4:8])
        body = " ".join(lines[timing_index + 1 :])
        voice = _VTT_VOICE.match(body)
        if voice:
            speaker, text = voice.group(1).strip(), voice.group(2)
        else:
            speaker, text = _split_speaker(_TAG.sub("", body))
        text = _TAG.sub("", text).strip()
        if text:
            segments.append(ParsedSegment(speaker, start, end, text))
    return segments


def _parse_json(content: str) -> list[ParsedSegment]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise TranscriptParseError(f"Invalid JSON: {exc.msg}") from exc

    if isinstance(data, dict):
        data = data.get("segments") or data.get("transcript") or data.get("sentences") or []
    if not isinstance(data, list):
        raise TranscriptParseError("JSON transcript must be a list of segments or {\"segments\": [...]}")

    segments: list[ParsedSegment] = []
    cursor = 0.0
    for item in data:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or item.get("content") or "").strip()
        if not text:
            continue
        speaker = item.get("speaker") or item.get("speaker_name") or item.get("name")
        start = _num(item.get("start", item.get("start_time", item.get("startTime"))))
        end = _num(item.get("end", item.get("end_time", item.get("endTime"))))
        start = cursor if start is None else start
        end = start + _estimate_duration(text) if end is None else end
        segments.append(ParsedSegment(str(speaker).strip() if speaker else None, start, end, text))
        cursor = end
    return segments


def _num(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = re.fullmatch(_TIMESTAMP, str(value).strip())
    if match:
        return _to_seconds(*match.groups())
    try:
        return float(value)
    except ValueError:
        return None


def _parse_txt(content: str) -> list[ParsedSegment]:
    segments: list[ParsedSegment] = []
    cursor = 0.0
    pending_speaker: str | None = None

    for raw in content.split("\n"):
        line = raw.strip()
        if not line:
            continue

        start: float | None = None
        speaker: str | None = None
        text = line

        if m := _TXT_SPEAKER_THEN_TIME.match(line):
            speaker = m.group(1).strip()
            start = _to_seconds(*m.groups()[1:5])
            text = m.group(6).strip()
        elif m := _TXT_BRACKETED.match(line):
            start = _to_seconds(*m.groups()[0:4])
            speaker, text = _split_speaker(m.group(5))
        else:
            speaker, text = _split_speaker(line)

        if not text:
            pending_speaker = speaker or pending_speaker
            continue

        speaker = speaker or pending_speaker
        pending_speaker = None
        start = cursor if start is None else start
        end = start + _estimate_duration(text)
        segments.append(ParsedSegment(speaker, start, end, text))
        cursor = end

    return segments


def _normalize(segments: list[ParsedSegment]) -> list[ParsedSegment]:
    segments = sorted(segments, key=lambda s: s.start)
    for i, seg in enumerate(segments):
        next_start = segments[i + 1].start if i + 1 < len(segments) else None
        if next_start is not None and seg.end > next_start:
            seg.end = max(seg.start, next_start)
        if seg.end <= seg.start:
            seg.end = seg.start + _estimate_duration(seg.text)
            if next_start is not None:
                seg.end = min(seg.end, next_start) if next_start > seg.start else seg.start
    return segments


def _merge_consecutive(segments: list[ParsedSegment], max_gap: float = 1.0, max_words: int = 90) -> list[ParsedSegment]:
    merged: list[ParsedSegment] = []
    for seg in segments:
        prev = merged[-1] if merged else None
        if (
            prev
            and prev.speaker == seg.speaker
            and seg.start - prev.end <= max_gap
            and len(prev.text.split()) + len(seg.text.split()) <= max_words
        ):
            prev.text = f"{prev.text} {seg.text}"
            prev.end = max(prev.end, seg.end)
        else:
            merged.append(ParsedSegment(seg.speaker, seg.start, seg.end, seg.text))
    return merged
