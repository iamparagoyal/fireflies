import { describe, expect, it } from "vitest";

import { colorForName, dateGroupLabel, formatClock, formatDuration, formatMeetingDate, initials, parseApiDate, platformLabel } from "../format";

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65.9)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("00:00");
  });
});

describe("formatDuration", () => {
  it("rounds to minutes and hours", () => {
    expect(formatDuration(20)).toBe("<1 min");
    expect(formatDuration(724)).toBe("12 min");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(5400)).toBe("1h 30m");
  });
});

describe("dates", () => {
  it("treats naive API timestamps as UTC", () => {
    expect(parseApiDate("2026-09-20T10:00:00").toISOString()).toBe("2026-09-20T10:00:00.000Z");
    expect(parseApiDate("2026-09-20T10:00:00Z").toISOString()).toBe("2026-09-20T10:00:00.000Z");
  });

  it("labels relative days", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    expect(formatMeetingDate(now.toISOString(), now)).toMatch(/^Today, /);
    expect(formatMeetingDate(new Date(now.getTime() - 86_400_000).toISOString(), now)).toMatch(/^Yesterday, /);
    expect(dateGroupLabel(new Date(now.getTime() - 3 * 86_400_000).toISOString(), now)).toBe("This week");
    expect(dateGroupLabel(new Date(now.getTime() - 10 * 86_400_000).toISOString(), now)).toBe("Last week");
    expect(dateGroupLabel("2026-01-05T10:00:00Z", now)).toBe("January 2026");
  });
});

describe("people helpers", () => {
  it("builds initials and stable colors", () => {
    expect(initials("Dana Lee")).toBe("DL");
    expect(initials("  cher ")).toBe("C");
    expect(initials("Mary Ann Smith")).toBe("MS");
    expect(colorForName("Dana Lee")).toBe(colorForName("Dana Lee"));
    expect(colorForName("Dana Lee")).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("labels platforms", () => {
    expect(platformLabel("google_meet")).toBe("Google Meet");
    expect(platformLabel("other")).toBe("other");
  });
});
