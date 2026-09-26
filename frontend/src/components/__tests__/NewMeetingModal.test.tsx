import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewMeetingModal } from "@/components/meetings/NewMeetingModal";
import { meetingDetail } from "@/test/fixtures";
import { router } from "@/test/navigation";
import { mockApi, renderWithSWR } from "@/test/utils";

const base = { "GET /participants": [{ id: 7, name: "Grace Liu", email: "grace@acme.com" }], "GET /tags": [{ id: 1, name: "Sales", color: "#10B981" }] };

function renderModal(tab: "upload" | "paste" | "form") {
  const onClose = vi.fn();
  const onTabChange = vi.fn();
  renderWithSWR(<NewMeetingModal tab={tab} onClose={onClose} onTabChange={onTabChange} />);
  return { onClose, onTabChange };
}

describe("NewMeetingModal", () => {
  it("validates required fields per mode", async () => {
    mockApi(base);
    renderModal("paste");
    await userEvent.click(screen.getByRole("button", { name: "Transcribe & summarize" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give the meeting a title");
    await userEvent.type(screen.getByLabelText("Title"), "Sync");
    await userEvent.click(screen.getByRole("button", { name: "Transcribe & summarize" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Paste a transcript");
  });

  it("creates a meeting from a pasted transcript and opens it", async () => {
    const api = mockApi({ ...base, "POST /meetings": meetingDetail({ id: 42 }) });
    const { onClose } = renderModal("paste");
    await userEvent.type(screen.getByLabelText("Title"), "Pricing sync");
    await userEvent.type(screen.getByLabelText("Participants"), "Grace Liu{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "Sales" }));
    await userEvent.click(screen.getByRole("button", { name: "Use a sample transcript" }));
    await userEvent.click(screen.getByRole("button", { name: "Transcribe & summarize" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/meetings/42"));
    const body = api.calls.find((c) => c.method === "POST")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ title: "Pricing sync", tag_ids: [1], participants: [{ name: "Grace Liu", email: "grace@acme.com", is_host: true }] });
    expect(body.transcript).toContain("Jordan Blake:");
    expect(onClose).toHaveBeenCalled();
  });

  it("uploads a transcript file", async () => {
    const api = mockApi({ ...base, "POST /meetings/upload": meetingDetail({ id: 5 }) });
    renderModal("upload");
    const file = new File(["WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v A>Hi"], "customer_call.vtt", { type: "text/vtt" });
    await userEvent.upload(screen.getByLabelText("Transcript file"), file);
    expect(screen.getByText("customer_call.vtt")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("customer call");
    await userEvent.click(screen.getByRole("button", { name: "Transcribe & summarize" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/meetings/5"));
    const form = api.calls.find((c) => c.path === "/meetings/upload")!.body as FormData;
    expect((form.get("file") as File).name).toBe("customer_call.vtt");
    expect(form.get("title")).toBe("customer call");
  });

  it("rejects unsupported files", async () => {
    mockApi(base);
    renderModal("upload");
    await userEvent.upload(screen.getByLabelText("Transcript file"), new File(["x"], "audio.mp3"), { applyAccept: false });
    expect(screen.getByRole("alert")).toHaveTextContent("Upload a .txt, .vtt, .srt or .json transcript");
  });

  it("creates a meeting from the manual form and shows server errors", async () => {
    mockApi({ ...base, "POST /meetings": new Response(JSON.stringify({ detail: "Something broke" }), { status: 500 }) });
    const { onTabChange } = renderModal("form");
    await userEvent.type(screen.getByLabelText("Title"), "Planning");
    await userEvent.click(screen.getByRole("button", { name: "Create meeting" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one participant");
    await userEvent.type(screen.getByLabelText("Participants"), "Ana, Ben,");
    expect(screen.getByRole("button", { name: "Remove Ben" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create meeting" }));
    expect(await screen.findByText("Something broke")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Upload file/ }));
    expect(onTabChange).toHaveBeenCalledWith("upload");
  });
});
