import type { Segment } from "./types";

export interface TextPart {
  text: string;
  match: boolean;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitHighlights(text: string, query: string): TextPart[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const pattern = new RegExp(`(${escapeRegExp(q)})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, match: part.toLowerCase() === q.toLowerCase() }));
}

export function splitSnippet(snippet: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /\u0002(.*?)\u0003/g;
  let last = 0;
  for (const m of snippet.matchAll(pattern)) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), match: false });
    parts.push({ text: m[1], match: true });
    last = m.index + m[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), match: false });
  return parts;
}

export function countMatches(text: string, query: string): number {
  const q = query.trim();
  if (!q) return 0;
  return text.match(new RegExp(escapeRegExp(q), "gi"))?.length ?? 0;
}

export interface MatchLocation {
  segmentId: number;
  occurrence: number;
}

export function findMatches(segments: Segment[], query: string): MatchLocation[] {
  const matches: MatchLocation[] = [];
  for (const segment of segments) {
    const count = countMatches(segment.text, query);
    for (let i = 0; i < count; i++) matches.push({ segmentId: segment.id, occurrence: i });
  }
  return matches;
}

export function activeSegmentIndex(segments: Segment[], time: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start_seconds <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export interface SpeakerBlock {
  speaker: string;
  start: number;
  end: number;
}

export function speakerTimeline(segments: Segment[]): SpeakerBlock[] {
  return segments.map((s) => ({ speaker: s.speaker_name ?? "Unknown", start: s.start_seconds, end: s.end_seconds }));
}
