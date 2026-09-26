import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MeetingLibrary, groupMeetings } from "@/components/meetings/MeetingLibrary";
import { listItem, meetingDetail } from "@/test/fixtures";
import { router, setSearchParams } from "@/test/navigation";
import { mockApi, renderWithSWR } from "@/test/utils";

const now = new Date();
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const meetings = [
  listItem({ id: 1, title: "Standup", started_at: iso(0), tags: [{ id: 1, name: "Engineering", color: "#6366F1" }] }),
  listItem({ id: 2, title: "Acme call", started_at: iso(1) }),
  listItem({ id: 3, title: "Old review", started_at: iso(40) }),
];

const common = { "GET /participants": [{ id: 1, name: "Dana Lee", email: null }], "GET /tags": [{ id: 1, name: "Engineering", color: "#6366F1" }] };

describe("MeetingLibrary", () => {
  it("groups meetings by date", () => {
    const groups = groupMeetings(meetings, true, now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", expect.any(String)]);
    expect(groupMeetings(meetings, false)).toHaveLength(1);
  });

  it("lists meetings with titles, tags and participants", async () => {
    mockApi({ ...common, "GET /meetings": { items: meetings, total: 3, page: 1, page_size: 50 } });
    renderWithSWR(<MeetingLibrary title="My Meetings" subtitle="All" />);
    expect(await screen.findByRole("link", { name: "Standup" })).toHaveAttribute("href", "/meetings/1");
    expect(screen.getByText("3 meetings", { exact: false })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Today" })).getByText("Engineering")).toBeInTheDocument();
  });

  it("sends filters to the API and mirrors them in the URL", async () => {
    const api = mockApi({ ...common, "GET /meetings": { items: [], total: 0, page: 1, page_size: 50 } });
    renderWithSWR(<MeetingLibrary title="My Meetings" subtitle="All" />);
    await userEvent.type(screen.getByPlaceholderText("Filter by title or participant"), "acme");
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "oldest");
    await userEvent.selectOptions(await screen.findByLabelText("Tag"), "1");
    await waitFor(() => expect(api.calls.some((c) => c.path === "/meetings?q=acme&tag_id=1&sort=oldest")).toBe(true));
    expect(router.replace).toHaveBeenLastCalledWith("/meetings?q=acme&tag=1&sort=oldest", { scroll: false });
    expect(await screen.findByText("No meetings match your filters")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(router.replace).toHaveBeenLastCalledWith("/meetings?sort=oldest", { scroll: false });
  });

  it("reads initial filters from the URL and passes the source restriction", async () => {
    setSearchParams("participant=1&sort=title");
    const api = mockApi({ ...common, "GET /meetings": { items: [], total: 0, page: 1, page_size: 50 } });
    renderWithSWR(<MeetingLibrary title="Uploads" subtitle="Uploaded" sources={["upload"]} />);
    await waitFor(() => expect(api.calls.some((c) => c.path === "/meetings?participant_id=1&source=upload&sort=title")).toBe(true));
  });

  it("deletes a meeting after confirmation", async () => {
    const api = mockApi({ ...common, "GET /meetings": { items: meetings, total: 3, page: 1, page_size: 50 }, "DELETE /meetings/2": undefined });
    renderWithSWR(<MeetingLibrary title="My Meetings" subtitle="All" />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Acme call" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    const dialog = await screen.findByRole("dialog", { name: "Delete meeting?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.calls).toContainEqual(expect.objectContaining({ method: "DELETE", path: "/meetings/2" })));
  });

  it("edits meeting metadata", async () => {
    const api = mockApi({
      ...common,
      "GET /meetings": { items: meetings, total: 3, page: 1, page_size: 50 },
      "PATCH /meetings/1": meetingDetail({ id: 1, title: "Daily standup" }),
    });
    renderWithSWR(<MeetingLibrary title="My Meetings" subtitle="All" />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Standup" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Edit details/ }));
    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Daily standup");
    await userEvent.click(screen.getByRole("button", { name: "Remove Dana Lee" }));
    await userEvent.type(screen.getByLabelText("Participants"), "Priya Nair{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(api.calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
        title: "Daily standup",
        participants: [{ name: "Priya Nair", is_host: true }],
        tag_ids: [1],
      }),
    );
  });

  it("shows an error when the backend is unreachable", async () => {
    mockApi({ ...common, "GET /meetings": new Response("oops", { status: 500 }) });
    renderWithSWR(<MeetingLibrary title="My Meetings" subtitle="All" />);
    expect(await screen.findByText(/Couldn't load meetings/)).toBeInTheDocument();
  });
});
