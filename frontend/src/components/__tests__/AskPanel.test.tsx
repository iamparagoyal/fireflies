import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AskPanel } from "@/components/meeting/AskPanel";
import { meetingDetail } from "@/test/fixtures";
import { mockApi, renderWithPlayer } from "@/test/utils";

describe("AskPanel", () => {
  it("asks a question and shows the answer with citations", async () => {
    mockApi({
      "GET /me": { user: { id: 1, name: "Alex", email: "a@x.io", avatar_color: "#000000" }, llm_enabled: false, llm_model: null },
      "POST /meetings/1/ask": { answer: "SSO is on the enterprise tier.", citations: [{ segment_id: 2, start_seconds: 8, speaker_name: "Sam Ortiz", text: "…" }], generated_by: "heuristic" },
    });
    renderWithPlayer(<AskPanel meeting={meetingDetail()} />);
    await userEvent.type(screen.getByLabelText("Ask a question about this meeting"), "What about SSO?");
    await userEvent.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText("SSO is on the enterprise tier.")).toBeInTheDocument();
    expect(screen.getByText("What about SSO?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Play from 00:08" }));
    expect(screen.getByTestId("harness-time")).toHaveTextContent("8");
  });

  it("uses suggestion chips and shows errors", async () => {
    mockApi({ "POST /meetings/1/ask": new Response(JSON.stringify({ detail: "Meeting not found" }), { status: 404 }) });
    renderWithPlayer(<AskPanel meeting={meetingDetail()} />);
    await userEvent.click(screen.getByRole("button", { name: "Summarize this meeting" }));
    expect(await screen.findByText("Meeting not found")).toBeInTheDocument();
  });
});
