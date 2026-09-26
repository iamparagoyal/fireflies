import { expect, test } from "@playwright/test";

test("global search jumps to the matching transcript moment", async ({ page }) => {
  await page.goto("/meetings");
  await page.getByPlaceholder("Search across all your meetings…").fill("Snowflake");
  await page.getByPlaceholder("Search across all your meetings…").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Snowflake/);
  const hit = page.getByRole("link").filter({ has: page.locator("mark") }).first();
  await expect(hit).toBeVisible();
  const href = await hit.getAttribute("href");
  const seconds = Number(new URL(href!, "http://x").searchParams.get("t"));
  await hit.click();
  await expect(page.locator("[data-active='true']")).toBeVisible();
  const slider = page.getByRole("slider", { name: "Seek" });
  await expect(slider).toHaveAttribute("aria-valuenow", String(seconds));
});

test("action items page completes tasks across meetings", async ({ page }) => {
  await page.goto("/tasks");
  const first = page.getByRole("button", { name: /^Mark “.*” as done$/ }).first();
  const label = await first.getAttribute("aria-label");
  const text = label!.match(/“(.*)”/)![1];
  await first.click();
  await expect(page.getByText("Marked as done")).toBeVisible();
  await page.getByRole("tab", { name: /Completed/ }).click();
  await expect(page.getByRole("main").getByText(text, { exact: true })).toBeVisible();
});

test("dark mode toggle persists", async ({ page }) => {
  await page.goto("/meetings");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("placeholder sections show coming soon", async ({ page }) => {
  for (const [path, heading] of [["/integrations", "Integrations"], ["/live", "Live Notetaker"], ["/team", "Team"], ["/analytics", "Conversation Analytics"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("Coming soon").first()).toBeVisible();
  }
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByText("Live notetaker is coming soon")).toBeVisible();
});
