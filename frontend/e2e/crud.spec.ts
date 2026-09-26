import { expect, test } from "@playwright/test";

const TRANSCRIPT = `[00:00:00] Nina Park: Thanks for joining. Today we finalize the partner webinar agenda.
[00:00:09] Omar Haddad: The webinar agenda has three sessions and the partner demo still needs a speaker.
[00:00:18] Nina Park: Omar, can you confirm the partner demo speaker by Friday?
[00:00:25] Omar Haddad: Yes, I'll confirm the speaker and send the webinar invite by Friday.
[00:00:33] Nina Park: Great. I will draft the webinar landing page tomorrow.`;

test("create from pasted transcript, edit, manage action items, delete", async ({ page }) => {
  await page.goto("/meetings");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.getByRole("tab", { name: "Paste transcript" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Partner webinar planning");
  await page.getByLabel("Transcript", { exact: true }).fill(TRANSCRIPT);
  await page.getByRole("button", { name: "Transcribe & summarize" }).click();

  await expect(page).toHaveURL(/\/meetings\/\d+$/);
  await expect(page.getByText("Meeting created")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Partner webinar planning" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Transcript" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("OVERVIEW", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/confirm the (partner demo )?speaker/i).first()).toBeVisible();

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit details" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Partner webinar kickoff");
  await page.getByLabel("Participants", { exact: true }).fill("Lena Ortiz");
  await page.getByLabel("Participants", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Partner webinar kickoff" })).toBeVisible();
  await expect(page.getByText("Meeting updated")).toBeVisible();

  await page.getByRole("tab", { name: /Action items/ }).click();
  await page.getByLabel("New action item", { exact: true }).fill("Book the webinar studio");
  await page.getByLabel("New action item assignee").selectOption({ label: "Lena Ortiz" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Book the webinar studio" })).toBeVisible();

  await page.getByRole("checkbox", { name: /Mark “Book the webinar studio” as done/ }).click();
  await expect(page.getByText("Completed · 1")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Action items/ }).click();
  await expect(page.getByText("Completed · 1")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Book the webinar studio/ })).toBeChecked();

  await page.getByRole("button", { name: "Book the webinar studio" }).hover();
  await page.getByRole("button", { name: "Delete action item" }).last().click();
  await expect(page.getByRole("button", { name: "Book the webinar studio" })).toHaveCount(0);

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete meeting" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/meetings$/);
  await expect(page.getByText("Partner webinar kickoff")).toHaveCount(0);
});

test("upload a transcript file", async ({ page }) => {
  await page.goto("/meetings");
  await page.getByRole("button", { name: "Upload meeting" }).click();
  await page.getByLabel("Transcript file").setInputFiles({
    name: "vendor_review.vtt",
    mimeType: "text/vtt",
    buffer: Buffer.from("WEBVTT\n\n00:00:01.000 --> 00:00:06.000\n<v Ravi Shah>We will renew the analytics vendor contract next week.\n\n00:00:07.000 --> 00:00:12.000\n<v Emma Stone>I'll send the renewal paperwork to legal tomorrow.\n"),
  });
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("vendor review");
  await page.getByRole("button", { name: "Transcribe & summarize" }).click();
  await expect(page.getByRole("heading", { name: "vendor review" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Transcript" })).toContainText("Emma Stone");

  await page.goto("/uploads");
  await expect(page.locator("li a[href^='/meetings/']").filter({ hasText: "vendor review" })).toHaveCount(1);
  await expect(page.locator("li a[href^='/meetings/']").filter({ hasText: "Weekly Product Sync" })).toHaveCount(0);
});

test("manual meeting without transcript", async ({ page }) => {
  await page.goto("/meetings");
  await page.getByRole("button", { name: "Upload meeting" }).click();
  await page.getByRole("tab", { name: "Manual entry" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Quarterly offsite");
  await page.getByLabel("Participants", { exact: true }).fill("Ana Cruz, Ben Ito,");
  await page.getByRole("button", { name: "Create meeting" }).click();
  await expect(page.getByRole("heading", { name: "Quarterly offsite" })).toBeVisible();
  await expect(page.getByText("No transcript")).toBeVisible();
});
