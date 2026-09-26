import logging
import math
import re
from collections import Counter

from app import models, schemas
from app.config import get_settings
from app.services.notes_generator import STOPWORDS, SegmentInput, format_transcript

logger = logging.getLogger(__name__)

_WORD = re.compile(r"[a-z0-9']+")


def _terms(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in STOPWORDS and len(w) > 2]


def _stem(word: str) -> str:
    for suffix in ("ing", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: -len(suffix)]
    return word


def rank_segments(meeting: models.Meeting, question: str, limit: int = 4) -> list[models.TranscriptSegment]:
    query = {_stem(t) for t in _terms(question)}
    if not query:
        return []
    doc_freq = Counter()
    seg_terms = []
    for seg in meeting.segments:
        stems = [_stem(t) for t in _terms(seg.text)]
        seg_terms.append(stems)
        doc_freq.update(set(stems))

    n = len(meeting.segments) or 1
    scored = []
    for seg, stems in zip(meeting.segments, seg_terms):
        tf = Counter(stems)
        score = sum(tf[t] * math.log(1 + n / doc_freq[t]) for t in query if t in tf)
        if score > 0:
            scored.append((score / math.sqrt(len(stems) or 1), seg))
    scored.sort(key=lambda item: -item[0])
    return sorted((seg for _, seg in scored[:limit]), key=lambda s: s.start_seconds)


def _citation(seg: models.TranscriptSegment) -> schemas.Citation:
    return schemas.Citation(
        segment_id=seg.id,
        start_seconds=seg.start_seconds,
        speaker_name=seg.speaker.name if seg.speaker else None,
        text=seg.text,
    )


def _fmt_time(seconds: float) -> str:
    seconds = int(seconds)
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def answer_heuristic(meeting: models.Meeting, question: str) -> schemas.AskResponse:
    lowered = question.lower()
    if meeting.summary and re.search(r"\b(summar\w*|overview|recap|tl;?dr)\b", lowered):
        return schemas.AskResponse(answer=meeting.summary.overview, citations=[], generated_by="heuristic")
    if re.search(r"\b(action items?|next steps?|tasks?|todo|follow[- ]?ups?)\b", lowered) and meeting.action_items:
        lines = [
            f"- {a.text}" + (f" ({a.assignee.name})" if a.assignee else "") + (" ✓" if a.is_completed else "")
            for a in meeting.action_items
        ]
        return schemas.AskResponse(answer="Here are the action items:\n" + "\n".join(lines), citations=[], generated_by="heuristic")

    matches = rank_segments(meeting, question)
    if not matches:
        return schemas.AskResponse(
            answer="I couldn't find anything in this transcript about that. Try rephrasing or using a keyword that was said in the meeting.",
            citations=[],
            generated_by="heuristic",
        )
    quotes = "\n".join(
        f"- {seg.speaker.name if seg.speaker else 'Someone'} at {_fmt_time(seg.start_seconds)}: \"{seg.text}\"" for seg in matches
    )
    return schemas.AskResponse(
        answer=f"Here's what was said that relates to your question:\n{quotes}",
        citations=[_citation(s) for s in matches],
        generated_by="heuristic",
    )


def answer_with_llm(meeting: models.Meeting, question: str) -> schemas.AskResponse:
    import anthropic

    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    segments = [
        SegmentInput(s.speaker.name if s.speaker else None, s.start_seconds, s.end_seconds, s.text) for s in meeting.segments
    ]
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4000,
        system=(
            "You answer questions about a single meeting using only its transcript. Be concise. When you rely on a "
            "specific moment, cite it inline as [123s] using the transcript timestamp. If the transcript doesn't "
            "contain the answer, say so."
        ),
        messages=[
            {
                "role": "user",
                "content": f"Meeting: {meeting.title}\n\nTranscript:\n{format_transcript(segments)}\n\nQuestion: {question}",
            }
        ],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("LLM refused the question")
    answer = "".join(block.text for block in response.content if block.type == "text").strip()

    cited_seconds = {float(m) for m in re.findall(r"\[(\d+(?:\.\d+)?)s\]", answer)}
    citations = [_citation(s) for s in meeting.segments if round(s.start_seconds) in {round(c) for c in cited_seconds}]
    answer = re.sub(r"\[(\d+(?:\.\d+)?)s\]", lambda m: f"[{_fmt_time(float(m.group(1)))}]", answer)
    return schemas.AskResponse(answer=answer, citations=citations[:6], generated_by=f"llm:{settings.anthropic_model}")


def answer_question(meeting: models.Meeting, question: str) -> schemas.AskResponse:
    if get_settings().anthropic_api_key and meeting.segments:
        try:
            return answer_with_llm(meeting, question)
        except Exception:
            logger.exception("LLM question answering failed, falling back to heuristic")
    return answer_heuristic(meeting, question)
