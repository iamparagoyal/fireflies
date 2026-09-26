import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TranscriptPanel } from "@/components/meeting/TranscriptPanel";
import { segments } from "@/test/fixtures";
import { mockApi, renderWithPlayer } from "@/test/utils";

const comments = [{ id: 5, segment_id: 2, body: "Follow up on SSO", created_at: "2026-09-20T10:05:00", author: { id: 1, name: "Alex Morgan", email: "a@x.io", avatar_color: "#7C5CFC" } }];

function setup() {
  const api = mockApi({ "GET /meetings/1/comments": comments, "POST /segments/2/comments": comments[0], "POST /meetings/1/soundbites": { id: 1 } });
  renderWithPlayer(<TranscriptPanel meetingId={1} segments={segments} />);
  return api;
}

describe("TranscriptPanel", () => {
  it("renders speaker labels and timestamps", () => {
    setup();
    const lines = within(screen.getByRole("list", { name: "Transcript" })).getAllByRole("listitem");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toHaveTextContent("Sam Ortiz");
    expect(within(lines[2]).getByRole("button", { name: "Play from 00:16" })).toBeInTheDocument();
  });

  it("highlights search matches and steps through them", async () => {
    setup();
    await userEvent.type(screen.getByPlaceholderText("Search transcript"), "pricing");
    await waitFor(() => expect(screen.getByTestId("match-count")).toHaveTextContent("1 of 3"));
    expect(document.querySelectorAll("mark")).toHaveLength(3);
    expect(document.querySelector('mark[data-active="true"]')).toHaveTextContent(/pricing/i);

    await userEvent.click(screen.getByRole("button", { name: "Next match" }));
    expect(screen.getByTestId("match-count")).toHaveTextContent("2 of 3");
    await userEvent.click(screen.getByRole("button", { name: "Previous match" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous match" }));
    expect(screen.getByTestId("match-count")).toHaveTextContent("3 of 3");

    await userEvent.clear(screen.getByPlaceholderText("Search transcript"));
    await userEvent.type(screen.getByPlaceholderText("Search transcript"), "zebra");
    await waitFor(() => expect(screen.getByTestId("match-count")).toHaveTextContent("No results"));
  });

  it("seeks the player when a line is clicked and marks it active", async () => {
    setup();
    fireEvent.click(screen.getAllByTestId("segment-text")[2]);
    expect(screen.getByTestId("harness-time")).toHaveTextContent("16");
    expect(screen.getByTestId("harness-playing")).toHaveTextContent("true");
    expect(document.getElementById("segment-3")).toHaveAttribute("data-active", "true");
  });

  it("filters by speaker", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Dana Lee" }));
    const lines = within(screen.getByRole("list", { name: "Transcript" })).getAllByRole("listitem");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveTextContent("Sam Ortiz");
  });

  it("shows and adds comments on a line", async () => {
    const api = setup();
    await userEvent.click(screen.getByRole("button", { name: "1 comments" }));
    expect(await screen.findByText("Follow up on SSO")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Add a comment"), "Great point");
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect(api.calls).toContainEqual(expect.objectContaining({ method: "POST", path: "/segments/2/comments", body: { body: "Great point" } })));
  });

  it("creates a soundbite from a line", async () => {
    const api = setup();
    await userEvent.click(screen.getAllByRole("button", { name: "Create soundbite from this line" })[0]);
    await waitFor(() =>
      expect(api.calls.find((c) => c.path === "/meetings/1/soundbites")?.body).toMatchObject({ start_seconds: 0, end_seconds: 8 }),
    );
  });
});
