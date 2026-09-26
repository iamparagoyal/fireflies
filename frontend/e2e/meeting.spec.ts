import { expect, test } from "@playwright/test";

async function openMeeting(page: import("@playwright/test").Page, title: string) {
  await page.goto("/meetings");
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("transcript and player stay in sync", async ({ page }) => {
  await openMeeting(page, "Weekly Product Sync");
  const lines = page.getByRole("list", { name: "Transcript" }).getByRole("listitem");
  await lines.nth(10).getByTestId("segment-text").click();
  await expect(lines.nth(10)).toHaveAttribute("data-active", "true");
  const time = await lines.nth(10).getByRole("button", { name: /Play from/ }).innerText();
  await expect(page.getByTestId("player-time")).toContainText(time);

  await page.getByRole("button", { name: "Pause" }).click();
  const slider = page.getByRole("slider", { name: "Seek" });
  const box = (await slider.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  const value = Number(await slider.getAttribute("aria-valuenow"));
  const max = Number(await slider.getAttribute("aria-valuemax"));
  expect(Math.abs(value - max / 2)).toBeLessThan(max * 0.05);
  await expect(page.locator("[data-active='true']")).toHaveCount(1);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(1500);
  expect(Number(await slider.getAttribute("aria-valuenow"))).toBeGreaterThan(value);
});

test("search within the transcript highlights matches", async ({ page }) => {
  await openMeeting(page, "Acme Corp Discovery Call");
  await page.getByPlaceholder("Search transcript").fill("SOC");
  await expect(page.getByTestId("match-count")).toHaveText(/^1 of \d+$/);
  const total = Number((await page.getByTestId("match-count").innerText()).split(" of ")[1]);
  await expect(page.locator("mark")).toHaveCount(total);
  await page.getByPlaceholder("Search transcript").press("Enter");
  await expect(page.getByTestId("match-count")).toHaveText(`2 of ${total}`);
  await expect(page.locator("mark[data-active='true']")).toBeInViewport();
});

test("summary outline seeks, speakers and soundbites work", async ({ page }) => {
  await openMeeting(page, "Sprint 42 Planning");
  const outline = page.getByRole("listitem").filter({ has: page.locator("button[aria-current], button") }).locator("button", { hasText: /^\d\d:\d\d/ });
  await outline.nth(2).click();
  await expect(outline.nth(2)).toHaveAttribute("aria-current", "step");

  await page.getByRole("tab", { name: "Speakers" }).click();
  await expect(page.getByText("Talk time")).toBeVisible();

  await page.getByRole("tab", { name: "Soundbites" }).click();
  await page.getByLabel("Soundbite title").fill("Scope decision");
  await page.getByRole("button", { name: "Clip" }).click();
  await expect(page.getByText("Scope decision")).toBeVisible();
  await page.getByRole("button", { name: "Delete soundbite Scope decision" }).click();
  await expect(page.getByText("Scope decision")).toHaveCount(0);
});

test("comment on a transcript line", async ({ page }) => {
  await openMeeting(page, "Globex Onboarding Kickoff");
  const line = page.getByRole("list", { name: "Transcript" }).getByRole("listitem").nth(3);
  await line.hover();
  await line.getByRole("button", { name: "Comment on this line" }).click();
  await line.getByLabel("Add a comment").fill("Loop in the SSO team here");
  await line.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(line.getByText("Loop in the SSO team here")).toBeVisible();
  await expect(line.getByRole("button", { name: "1 comments" })).toBeVisible();
});

test("ask AI answers with transcript citations", async ({ page }) => {
  await openMeeting(page, "Acme Corp Discovery Call");
  await page.getByRole("tab", { name: "Ask AI" }).click();
  await page.getByLabel("Ask a question about this meeting").fill("What did they say about the budget?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText(/Here's what was said|budget/i).last()).toBeVisible();
  await expect(page.getByRole("tabpanel").getByRole("button", { name: /Play from/ }).first()).toBeVisible();
});

test("regenerate notes and export", async ({ page }) => {
  await openMeeting(page, "Q4 Campaign Review");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Regenerate AI notes" }).click();
  await expect(page.getByText("AI notes regenerated")).toBeVisible();
  await expect(page.getByText("Generated from transcript")).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Markdown (.md)" }).click()]);
  expect(download.suggestedFilename()).toBe("q4-campaign-review.md");
});
