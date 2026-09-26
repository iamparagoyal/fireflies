import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ActionItemsPanel } from "@/components/meeting/ActionItemsPanel";
import { actionItem, meetingDetail } from "@/test/fixtures";
import { mockApi, renderWithPlayer } from "@/test/utils";

describe("ActionItemsPanel", () => {
  it("lists open and completed items", () => {
    mockApi({});
    renderWithPlayer(<ActionItemsPanel meeting={meetingDetail({ action_items: [actionItem(), actionItem({ id: 11, text: "Ship it", is_completed: true })] })} />);
    expect(screen.getByText("To do · 1")).toBeInTheDocument();
    expect(screen.getByText("Completed · 1")).toBeInTheDocument();
  });

  it("completes an item", async () => {
    const api = mockApi({ "PATCH /action-items/10": actionItem({ is_completed: true }), "GET /meetings?q=": {} });
    renderWithPlayer(<ActionItemsPanel meeting={meetingDetail()} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Mark “Draft the launch email” as done/ }));
    await waitFor(() => expect(api.calls).toContainEqual(expect.objectContaining({ method: "PATCH", path: "/action-items/10", body: { is_completed: true } })));
  });

  it("edits text inline and reassigns", async () => {
    const api = mockApi({ "PATCH /action-items/10": actionItem() });
    renderWithPlayer(<ActionItemsPanel meeting={meetingDetail()} />);
    await userEvent.click(screen.getByRole("button", { name: "Draft the launch email" }));
    const input = screen.getByLabelText("Edit action item");
    await userEvent.clear(input);
    await userEvent.type(input, "Draft and send the launch email{Enter}");
    await userEvent.selectOptions(screen.getByLabelText("Assignee"), "2");
    await waitFor(() => {
      const bodies = api.calls.filter((c) => c.method === "PATCH").map((c) => c.body);
      expect(bodies).toContainEqual({ text: "Draft and send the launch email" });
      expect(bodies).toContainEqual({ assignee_id: 2 });
    });
  });

  it("adds and deletes items", async () => {
    const api = mockApi({ "POST /meetings/1/action-items": actionItem({ id: 12, text: "Book a room", is_ai_generated: false }), "DELETE /action-items/10": undefined });
    renderWithPlayer(<ActionItemsPanel meeting={meetingDetail()} />);
    await userEvent.type(screen.getByLabelText("New action item"), "Book a room");
    await userEvent.selectOptions(screen.getByLabelText("New action item assignee"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(api.calls).toContainEqual(expect.objectContaining({ method: "POST", body: { text: "Book a room", assignee_id: 1 } })));
    expect(screen.getByLabelText("New action item")).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "Delete action item" }));
    await waitFor(() => expect(api.calls).toContainEqual(expect.objectContaining({ method: "DELETE", path: "/action-items/10" })));
  });
});
