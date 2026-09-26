import { expect, test } from "@playwright/test";

test.describe("meetings library", () => {
  test("lists seeded meetings newest first with participants and tags", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/meetings$/);
    await expect(page.getByRole("heading", { name: "My Meetings" })).toBeVisible();
    const titles = page.locator("li a[href^='/meetings/']");
    await expect(titles.filter({ hasText: "Board Prep: Q3 Metrics" })).toHaveCount(1);
    expect(await titles.count()).toBeGreaterThanOrEqual(8);
    const all = await titles.allInnerTexts();
    expect(all.indexOf("Board Prep: Q3 Metrics")).toBeLessThan(all.indexOf("Sprint 42 Planning"));
    await expect(page.getByText("Today", { exact: true })).toBeVisible();
  });

  test("filters by title, participant, tag and date and sorts", async ({ page }) => {
    await page.goto("/meetings");
    await page.getByPlaceholder("Filter by title or participant").fill("acme");
    await expect(page.locator("li a[href^='/meetings/']")).toHaveText(["Acme Corp Discovery Call"]);
    await expect(page).toHaveURL(/q=acme/);

    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByLabel("Participant", { exact: true }).selectOption({ label: "Grace Liu" });
    await expect(page.locator("li a[href^='/meetings/']")).toHaveText(["Acme Corp Discovery Call"]);

    await page.getByLabel("Participant", { exact: true }).selectOption({ label: "All participants" });
    await page.getByLabel("Tag", { exact: true }).selectOption({ label: "Hiring" });
    await expect(page.locator("li a[href^='/meetings/']")).toHaveCount(1);

    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByLabel("Sort").selectOption("oldest");
    await expect(page.locator("li a[href^='/meetings/']").first()).toHaveText("Sprint 42 Planning");

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await page.getByLabel("From date").fill(iso);
    await expect(page.locator("li a[href^='/meetings/']").filter({ hasText: "Board Prep: Q3 Metrics" })).toHaveCount(1);
    await expect(page.locator("li a[href^='/meetings/']").filter({ hasText: "Sprint 42 Planning" })).toHaveCount(0);
  });

  test("filter state survives a reload", async ({ page }) => {
    await page.goto("/meetings?q=globex&sort=title");
    await expect(page.getByPlaceholder("Filter by title or participant")).toHaveValue("globex");
    await expect(page.locator("li a[href^='/meetings/']")).toHaveText(["Globex Onboarding Kickoff"]);
  });
});
