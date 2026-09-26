import { describe, expect, it } from "vitest";

import { mockApi } from "@/test/utils";

import { ApiError, api, meetingsQuery } from "../api";
import { filtersFromParams, filtersToParams } from "../filterParams";

describe("meetingsQuery", () => {
  it("serializes filters for the backend", () => {
    expect(meetingsQuery()).toBe("/meetings");
    expect(
      meetingsQuery({ q: " acme ", participantIds: [2, 3], tagIds: [1], dateFrom: "2026-09-01", dateTo: "2026-09-30", sort: "oldest", sources: ["upload"] }),
    ).toBe(
      "/meetings?q=acme&participant_id=2&participant_id=3&tag_id=1&source=upload&date_from=2026-09-01T00%3A00%3A00&date_to=2026-09-30T23%3A59%3A59&sort=oldest",
    );
  });
});

describe("filter URL params", () => {
  it("round-trips through the address bar", () => {
    const filters = { q: "acme", participantIds: [4], tagIds: [2], dateFrom: "2026-09-01", sort: "title" as const };
    const parsed = filtersFromParams(new URLSearchParams(filtersToParams(filters)));
    expect(parsed).toMatchObject(filters);
  });

  it("ignores invalid values", () => {
    const parsed = filtersFromParams(new URLSearchParams("participant=abc&sort=bogus"));
    expect(parsed.participantIds).toEqual([]);
    expect(parsed.sort).toBe("recent");
  });
});

describe("request", () => {
  it("sends JSON and parses responses", async () => {
    const mock = mockApi({ "POST /meetings/1/ask": (body: unknown) => ({ answer: `echo ${(body as { question: string }).question}`, citations: [], generated_by: "heuristic" }) });
    const result = await api.ask(1, "hi");
    expect(result.answer).toBe("echo hi");
    expect(mock.calls[0]).toMatchObject({ method: "POST", path: "/meetings/1/ask", body: { question: "hi" } });
  });

  it("returns undefined for 204", async () => {
    mockApi({ "DELETE /meetings/3": undefined });
    await expect(api.deleteMeeting(3)).resolves.toBeUndefined();
  });

  it("surfaces FastAPI error details", async () => {
    mockApi({
      "GET /meetings/9": new Response(JSON.stringify({ detail: "Meeting not found" }), { status: 404 }),
      "POST /meetings": new Response(JSON.stringify({ detail: [{ msg: "Field required" }] }), { status: 422 }),
    });
    await expect(api.getMeeting(9)).rejects.toEqual(new ApiError(404, "Meeting not found"));
    await expect(api.createMeeting({ title: "" })).rejects.toThrow("Field required");
  });
});
