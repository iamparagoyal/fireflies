import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MediaPlayer } from "@/components/meeting/MediaPlayer";
import { meetingDetail, segments } from "@/test/fixtures";
import { renderWithPlayer } from "@/test/utils";

describe("MediaPlayer", () => {
  const renderPlayer = () => renderWithPlayer(<MediaPlayer segments={segments} chapters={meetingDetail().chapters} mediaUrl={null} />, 30);

  it("toggles play and pause", async () => {
    renderPlayer();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByTestId("harness-playing")).toHaveTextContent("false");
  });

  it("skips and seeks with the keyboard", async () => {
    renderPlayer();
    await userEvent.click(screen.getByRole("button", { name: "Forward 15 seconds" }));
    expect(screen.getByTestId("player-time")).toHaveTextContent("00:15 / 00:30");
    const slider = screen.getByRole("slider", { name: "Seek" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "20");
    await userEvent.click(screen.getByRole("button", { name: "Back 15 seconds" }));
    expect(screen.getByTestId("harness-time")).toHaveTextContent("5");
  });

  it("seeks when the track is clicked", () => {
    renderPlayer();
    const slider = screen.getByRole("slider", { name: "Seek" });
    slider.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 20, right: 300, bottom: 20, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(slider, { clientX: 150, pointerId: 1 });
    expect(screen.getByTestId("harness-time")).toHaveTextContent("15");
  });

  it("changes playback speed", async () => {
    renderPlayer();
    await userEvent.selectOptions(screen.getByLabelText("Playback speed"), "1.5");
    expect(screen.getByLabelText("Playback speed")).toHaveValue("1.5");
  });
});
