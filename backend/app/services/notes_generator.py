import logging
import math
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta

from pydantic import BaseModel, Field

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class SegmentInput:
    speaker: str | None
    start: float
    end: float
    text: str


@dataclass
class GeneratedActionItem:
    text: str
    assignee: str | None
    timestamp: float | None
    due_date: date | None = None


@dataclass
class GeneratedChapter:
    title: str
    start: float
    end: float
    summary: str


@dataclass
class GeneratedNotes:
    overview: str
    bullet_points: list[str]
    keywords: list[str]
    action_items: list[GeneratedActionItem] = field(default_factory=list)
    chapters: list[GeneratedChapter] = field(default_factory=list)
    generated_by: str = "heuristic"


STOPWORDS = set(
    """
    a about above actually after again against ah all almost also am an and any anything are around as at away back
    basically be because been before being below between both but by can can't cannot could couldn't did didn't do
    does doesn't doing don't done down during each either else even ever every everyone everything exactly few
    for from further get gets getting go goes going gonna good got gotta great guess had hadn't has hasn't have
    haven't having he he'd he'll he's her here here's hers herself hey hi him himself his how how's hmm i i'd i'll
    i'm i've if in into is isn't it it's its itself just kind kinda know let let's like little lot lots made make
    makes making many maybe me mean might mine more most much must my myself need needs no nor not nothing now of
    off oh okay ok on once one only or other our ours ourselves out over own pretty probably put quite rather
    really right said same say saying says see seems she she'd she'll she's should shouldn't so some something
    sort still such sure take talk talking tell than thank thanks that that's the their theirs them themselves
    then there there's these they they'd they'll they're they've thing things think thinking this those though
    through to too totally um uh under until up us use used very want wanted wants was wasn't way we we'd we'll
    we're we've well were weren't what what's when when's where where's whether which while who who's whom why
    why's will with within without won't would wouldn't yeah yep yes yet you you'd you'll you're you've your
    yours yourself yourselves go-to anyway alright awesome cool definitely literally honestly bit come coming
    look looking looks start started stuff today tomorrow week weeks next last day days time times first second
    monday tuesday wednesday thursday friday saturday sunday joining
    """.split()
)

_WORD = re.compile(r"[A-Za-z][A-Za-z0-9'\-]+")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_FILLER_PREFIX = re.compile(r"^(?:(?:so|okay|ok|yeah|yes|yep|um|uh|and|but|alright|right|well|great|cool|perfect|thanks for joining)[,.]?\s+)+", re.I)
_COMMITMENT = re.compile(
    r"\b(i'll|i will|i'm going to|i am going to|i can take|let me|we'll|we will|we need to|we should|let's|"
    r"you'll|can you|could you|please|make sure|follow up|action item|next step|i'm on it|i'll own|will send|"
    r"will share|will schedule|will set up|will draft|will update)\b",
    re.I,
)
_COMMIT_PREFIX = re.compile(
    r"^.*?\b(?:i'll|i will|i'm going to|i am going to|let me|we'll|we will|we need to|we should|let's|you'll|"
    r"can you|could you|please|make sure (?:to|that)?|i can)\s+",
    re.I,
)
_SELF_COMMIT = re.compile(r"\b(i'll|i will|i'm going to|i am going to|let me|i can take|i'm on it|i'll own)\b", re.I)
_ASK_OTHER = re.compile(r"\b(can you|could you|you'll|please)\b", re.I)
_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _words(text: str) -> list[str]:
    return [w.lower().strip("'-") for w in _WORD.findall(text)]


def _content_words(text: str, exclude: set[str]) -> list[str]:
    return [w for w in _words(text) if w not in STOPWORDS and w not in exclude and len(w) > 2 and not w.isdigit()]


def _sentences(segments: list[SegmentInput]) -> list[tuple[SegmentInput, str]]:
    out = []
    for seg in segments:
        for sentence in _SENTENCE_SPLIT.split(seg.text):
            sentence = sentence.strip()
            if sentence:
                out.append((seg, sentence))
    return out


def _clean_sentence(sentence: str) -> str:
    sentence = _FILLER_PREFIX.sub("", sentence).strip()
    return sentence[:1].upper() + sentence[1:] if sentence else sentence


def _keywords(segments: list[SegmentInput], exclude: set[str], limit: int = 8) -> list[str]:
    unigrams: Counter[str] = Counter()
    bigrams: Counter[tuple[str, str]] = Counter()
    for seg in segments:
        tokens = _words(seg.text)
        for i, tok in enumerate(tokens):
            if tok in STOPWORDS or tok in exclude or len(tok) <= 2 or tok.isdigit():
                continue
            unigrams[tok] += 1
            if i + 1 < len(tokens):
                nxt = tokens[i + 1]
                if nxt not in STOPWORDS and nxt not in exclude and len(nxt) > 2 and not nxt.isdigit():
                    bigrams[(tok, nxt)] += 1

    scored: list[tuple[float, str]] = []
    covered: set[str] = set()
    for (a, b), count in bigrams.most_common(limit * 2):
        if count >= 2:
            scored.append((count * 2.5, f"{a} {b}"))
            covered.update({a, b})
    for word, count in unigrams.most_common(limit * 3):
        if count >= 2 and word not in covered:
            scored.append((float(count), word))

    scored.sort(key=lambda item: -item[0])
    return [_title(k) for _, k in scored[:limit]]


ACRONYMS = {"api", "sso", "crm", "kpi", "okr", "roi", "arr", "mrr", "ui", "ux", "qa", "sla", "soc", "csv", "pdf", "q1", "q2", "q3", "q4"}


def _title(phrase: str) -> str:
    return " ".join(w.upper() if w in ACRONYMS else w.capitalize() for w in phrase.split())


def _sentence_scores(sentences: list[tuple[SegmentInput, str]], exclude: set[str]) -> list[float]:
    freq = Counter(w for _, s in sentences for w in _content_words(s, exclude))
    if not freq:
        return [0.0] * len(sentences)
    top = freq.most_common(1)[0][1]
    scores = []
    for _, sentence in sentences:
        words = _content_words(sentence, exclude)
        n_words = len(sentence.split())
        if n_words < 7 or n_words > 45 or sentence.endswith("?"):
            scores.append(0.0)
            continue
        base = sum(freq[w] / top for w in words) / math.sqrt(n_words)
        if re.search(r"\d", sentence):
            base *= 1.25
        if re.search(r"\b(decided|agreed|plan|goal|priority|launch|deadline|budget|risk|blocker)\b", sentence, re.I):
            base *= 1.3
        scores.append(base)
    return scores


def _emoji_for(sentence: str) -> str:
    lowered = sentence.lower()
    rules = [
        (r"\b(decided|agreed|approved|confirmed)\b", "✅"),
        (r"\b(risk|blocker|issue|concern|problem|bug|churn|delay)\b", "⚠️"),
        (r"\b(deadline|date|monday|tuesday|wednesday|thursday|friday|q[1-4]|quarter|week|month)\b", "📅"),
        (r"\d|%|\$", "📊"),
        (r"\b(customer|client|user|users)\b", "👥"),
        (r"\b(launch|release|ship|rollout)\b", "🚀"),
    ]
    for pattern, emoji in rules:
        if re.search(pattern, lowered):
            return emoji
    return "💡"


def _resolve_due_date(sentence: str, meeting_date: date) -> date | None:
    lowered = sentence.lower()
    if "tomorrow" in lowered:
        return meeting_date + timedelta(days=1)
    if "next week" in lowered:
        return meeting_date + timedelta(days=7)
    if re.search(r"end of (the )?week|\beow\b", lowered):
        return meeting_date + timedelta(days=(4 - meeting_date.weekday()) % 7 or 7)
    if re.search(r"end of (the )?day|\beod\b|today", lowered):
        return meeting_date
    for index, name in enumerate(_WEEKDAYS):
        if re.search(rf"\b{name}\b", lowered):
            return meeting_date + timedelta(days=(index - meeting_date.weekday()) % 7 or 7)
    return None


def _action_items(
    segments: list[SegmentInput], participants: list[str], meeting_date: date, limit: int = 8
) -> list[GeneratedActionItem]:
    first_names = {p.split()[0].lower(): p for p in participants if p}
    items: list[GeneratedActionItem] = []
    seen: set[str] = set()

    for index, seg in enumerate(segments):
        for sentence in _SENTENCE_SPLIT.split(seg.text):
            sentence = sentence.strip()
            if len(sentence.split()) < 5 or not _COMMITMENT.search(sentence):
                continue
            if re.search(r"\b(hear me|see my screen|share my screen|let me know if|let me think|let me see)\b", sentence, re.I):
                continue

            assignee = None
            mentioned = [name for first, name in first_names.items() if re.search(rf"\b{re.escape(first)}\b", sentence, re.I)]
            if _SELF_COMMIT.search(sentence):
                assignee = seg.speaker
            elif mentioned:
                assignee = mentioned[0]
            elif _ASK_OTHER.search(sentence):
                nxt = next((s.speaker for s in segments[index + 1 : index + 3] if s.speaker and s.speaker != seg.speaker), None)
                assignee = nxt

            task = _COMMIT_PREFIX.sub("", sentence, count=1).strip()
            task = re.sub(r"[?!.]+$", "", task)
            if len(task.split()) < 3:
                continue
            task = task[:1].upper() + task[1:]
            key = task.lower()[:60]
            if key in seen:
                continue
            seen.add(key)
            items.append(
                GeneratedActionItem(
                    text=task,
                    assignee=assignee,
                    timestamp=seg.start,
                    due_date=_resolve_due_date(sentence, meeting_date),
                )
            )
            if len(items) >= limit:
                return items
    return items


def _chapters(segments: list[SegmentInput], exclude: set[str]) -> list[GeneratedChapter]:
    if not segments:
        return []
    total = segments[-1].end - segments[0].start
    target = max(1, min(6, round(total / 240) or 1, len(segments) // 4 or 1))
    window = total / target
    buckets: list[list[SegmentInput]] = [[] for _ in range(target)]
    for seg in segments:
        idx = min(target - 1, int((seg.start - segments[0].start) / window)) if window else 0
        buckets[idx].append(seg)
    buckets = [b for b in buckets if b]

    doc_freq = Counter()
    for bucket in buckets:
        doc_freq.update(set(w for s in bucket for w in _content_words(s.text, exclude)))

    chapters = []
    for bucket in buckets:
        title_words = _keywords(bucket, exclude, limit=2)
        if len(title_words) < 2:
            tf = Counter(w for s in bucket for w in _content_words(s.text, exclude))
            ranked = sorted(tf, key=lambda w: -(tf[w] * math.log(1 + len(buckets) / doc_freq[w])))
            title_words += [_title(w) for w in ranked if _title(w) not in title_words][: 2 - len(title_words)]
        title_words = title_words or ["Discussion"]
        sentences = _sentences(bucket)
        scores = _sentence_scores(sentences, exclude)
        best = max(range(len(sentences)), key=lambda i: scores[i]) if sentences else None
        summary = _clean_sentence(sentences[best][1]) if best is not None else ""
        chapters.append(
            GeneratedChapter(
                title=" & ".join(title_words),
                start=bucket[0].start,
                end=bucket[-1].end,
                summary=summary,
            )
        )
    return chapters


def generate_heuristic(segments: list[SegmentInput], participants: list[str], meeting_date: date) -> GeneratedNotes:
    exclude = {part.lower() for name in participants for part in name.split()}
    keywords = _keywords(segments, exclude)
    sentences = _sentences(segments)
    scores = _sentence_scores(sentences, exclude)
    ranked = sorted(range(len(sentences)), key=lambda i: -scores[i])

    top_for_bullets = sorted(i for i in ranked[:6] if scores[i] > 0)
    bullets = [f"{_emoji_for(sentences[i][1])} {_clean_sentence(sentences[i][1])}" for i in top_for_bullets]

    speakers = [s for s, _ in Counter(seg.speaker for seg in segments if seg.speaker).most_common(3)]
    topics = ", ".join(k.lower() for k in keywords[:3])
    who = " and ".join([", ".join(speakers[:-1]), speakers[-1]] if len(speakers) > 1 else speakers) or "The team"
    intro = f"{who} met to discuss {topics or 'several topics'}."
    highlights = " ".join(_clean_sentence(sentences[i][1]) for i in sorted(ranked[:2]) if scores[i] > 0)
    overview = f"{intro} {highlights}".strip()

    return GeneratedNotes(
        overview=overview,
        bullet_points=bullets,
        keywords=keywords,
        action_items=_action_items(segments, participants, meeting_date),
        chapters=_chapters(segments, exclude),
        generated_by="heuristic",
    )


class _LLMActionItem(BaseModel):
    text: str = Field(description="Imperative task description, e.g. 'Send the SOC 2 report to Acme'")
    assignee: str | None = Field(description="Exact participant name responsible, or null")
    timestamp_seconds: float | None = Field(description="Start time of the transcript line where it was agreed")
    due_date: date | None = Field(description="Due date if one was stated, ISO format")


class _LLMChapter(BaseModel):
    title: str
    start_seconds: float
    end_seconds: float
    summary: str


class _LLMNotes(BaseModel):
    overview: str = Field(description="3-5 sentence paragraph summarising the meeting")
    bullet_points: list[str] = Field(description="5-8 shorthand notes, each starting with a relevant emoji")
    keywords: list[str] = Field(description="6-10 key topics")
    action_items: list[_LLMActionItem]
    chapters: list[_LLMChapter] = Field(description="3-6 contiguous chapters covering the whole meeting")


_SYSTEM_PROMPT = (
    "You are a meeting notetaker like Fireflies.ai. Given a transcript, produce concise, factual meeting notes. "
    "Only include action items that were explicitly agreed in the conversation. Use participant names exactly as "
    "written. Chapter timestamps must come from the transcript line timestamps."
)


def format_transcript(segments: list[SegmentInput]) -> str:
    return "\n".join(f"[{s.start:.0f}s] {s.speaker or 'Unknown'}: {s.text}" for s in segments)


def generate_with_llm(segments: list[SegmentInput], participants: list[str], meeting_date: date) -> GeneratedNotes:
    import anthropic

    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.parse(
        model=settings.anthropic_model,
        max_tokens=16000,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Meeting date: {meeting_date.isoformat()}\nParticipants: {', '.join(participants)}\n\n"
                    f"Transcript:\n{format_transcript(segments)}"
                ),
            }
        ],
        output_format=_LLMNotes,
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise RuntimeError(f"LLM did not return notes (stop_reason={response.stop_reason})")

    notes = response.parsed_output
    return GeneratedNotes(
        overview=notes.overview,
        bullet_points=notes.bullet_points,
        keywords=notes.keywords,
        action_items=[
            GeneratedActionItem(a.text, a.assignee, a.timestamp_seconds, a.due_date) for a in notes.action_items
        ],
        chapters=[GeneratedChapter(c.title, c.start_seconds, c.end_seconds, c.summary) for c in notes.chapters],
        generated_by=f"llm:{settings.anthropic_model}",
    )


def generate_notes(segments: list[SegmentInput], participants: list[str], meeting_date: date) -> GeneratedNotes:
    if get_settings().anthropic_api_key and segments:
        try:
            return generate_with_llm(segments, participants, meeting_date)
        except Exception:
            logger.exception("LLM note generation failed, falling back to heuristic")
    return generate_heuristic(segments, participants, meeting_date)
