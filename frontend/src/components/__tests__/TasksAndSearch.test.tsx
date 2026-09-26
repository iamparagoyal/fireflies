import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SearchView } from "@/components/meetings/SearchView";
import { TasksView, filterTasks } from "@/components/meetings/TasksView";
import { actionItem, listItem } from "@/test/fixtures";
import { setSearchParams } from "@/test/navigation";
import { mockApi, renderWithSWR } from "@/test/utils";

const tasks = [
  { ...actionItem({ id: 1, text: "Send SOC 2 report" }), meeting_title: "Acme call" },
  { ...actionItem({ id: 2, text: "Book venue", is_completed: true }), meeting_title: "Offsite" },
];

describe("TasksView", () => {
  it("filters by status", () => {
    expect(filterTasks(tasks, "open").map((t) => t.id)).toEqual([1]);
    expect(filterTasks(tasks, "done").map((t) => t.id)).toEqual([2]);
    expect(filterTasks(tasks, "all")).toHaveLength(2);
  });

  it("lists open tasks and completes one", async () => {
    const api = mockApi({ "GET /action-items": tasks, "PATCH /action-items/1": tasks[0] });
    renderWithSWR(<TasksView />);
    expect(await screen.findByText("Send SOC 2 report")).toBeInTheDocument();
    expect(screen.queryByText("Book venue")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acme call" })).toHaveAttribute("href", "/meetings/1");
    await userEvent.click(screen.getByRole("button", { name: "Mark “Send SOC 2 report” as done" }));
    await waitFor(() => expect(api.calls).toContainEqual(expect.objectContaining({ method: "PATCH", body: { is_completed: true } })));
    await userEvent.click(screen.getByRole("tab", { name: /Completed/ }));
    expect(screen.getByText("Book venue")).toBeInTheDocument();
  });
});

describe("SearchView", () => {
  it("shows meeting and transcript matches with highlights", async () => {
    setSearchParams("q=pricing");
    mockApi({
      "GET /search": {
        query: "pricing",
        meetings: [listItem({ id: 4, title: "Pricing review" })],
        hits: [{ meeting_id: 4, meeting_title: "Pricing review", meeting_started_at: "2026-09-20T10:00:00", segment_id: 9, start_seconds: 75, speaker_name: "Sam Ortiz", snippet: "the \u0002pricing\u0003 page" }],
      },
    });
    renderWithSWR(<SearchView />);
    expect(await screen.findByText("Transcript mentions · 1")).toBeInTheDocument();
    expect(screen.getByText("pricing", { selector: "mark" })).toBeInTheDocument();
    expect(screen.getByText("01:15").closest("a")).toHaveAttribute("href", "/meetings/4?t=75");
  });

  it("shows an empty state for no results", async () => {
    mockApi({ "GET /search": { query: "zzz", meetings: [], hits: [] } });
    renderWithSWR(<SearchView />);
    await userEvent.type(screen.getByLabelText("Search query"), "zzz");
    expect(await screen.findByText("No results for “zzz”")).toBeInTheDocument();
  });
});
