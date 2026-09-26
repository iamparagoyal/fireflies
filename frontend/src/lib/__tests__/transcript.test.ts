import { describe, expect, it } from "vitest";

import { segments } from "@/test/fixtures";

import { activeSegmentIndex, countMatches, findMatches, splitHighlights, splitSnippet } from "../transcript";

describe("splitHighlights", () => {
  it("marks case-insensitive matches", () => {
    expect(splitHighlights("Pricing and pricing", "PRICING")).toEqual([
      { text: "Pricing", match: true },
      { text: " and ", match: false },
      { text: "pricing", match: true },
    ]);
  });

  it("escapes regex characters and handles empty queries", () => {
    expect(splitHighlights("cost (USD)?", "(USD)?")).toEqual([
      { text: "cost ", match: false },
      { text: "(USD)?", match: true },
    ]);
    expect(splitHighlights("text", "  ")).toEqual([{ text: "text", match: false }]);
  });
});

describe("findMatches", () => {
  it("lists every occurrence in order", () => {
    expect(countMatches(segments[1].text, "pricing")).toBe(2);
    expect(findMatches(segments, "pricing")).toEqual([
      { segmentId: 1, occurrence: 0 },
      { segmentId: 2, occurrence: 0 },
      { segmentId: 2, occurrence: 1 },
    ]);
    expect(findMatches(segments, "")).toEqual([]);
  });
});

describe("activeSegmentIndex", () => {
  it("finds the segment playing at a time", () => {
    expect(activeSegmentIndex(segments, 0)).toBe(0);
    expect(activeSegmentIndex(segments, 9)).toBe(1);
    expect(activeSegmentIndex(segments, 100)).toBe(2);
    expect(activeSegmentIndex([], 3)).toBe(-1);
  });
});

describe("splitSnippet", () => {
  it("parses backend FTS highlight markers", () => {
    expect(splitSnippet("…the \u0002pricing\u0003 page")).toEqual([
      { text: "…the ", match: false },
      { text: "pricing", match: true },
      { text: " page", match: false },
    ]);
  });
});
