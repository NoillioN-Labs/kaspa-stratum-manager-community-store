import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const output = process.env.KSM_SCREENSHOT_DIR || "test-results";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.KSM_TEST_URL || "http://localhost:3100/");
  await page
    .getByText("Test fixture — simulated data for interface validation.")
    .waitFor();
  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page
    .getByText("1,852.5")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() =>
      page.locator(".suite-total").filter({ hasText: "KAS" }).waitFor(),
    );
  await page.waitForFunction(() =>
    document.querySelector(".suite-total")?.textContent?.includes("1,"),
  );
  await page.screenshot({
    path: `${output}/stratum-analytics-desktop.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "View full ledger" }).click();
  await page.locator(".suite-analytics > article tbody tr").first().waitFor();
  await page.getByRole("combobox").selectOption("blue");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("tbody .suite-state")].every(
        (e) => e.textContent === "Blue",
      ) && document.querySelectorAll("tbody .suite-state").length > 0,
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("tbody .suite-state").length < 50,
  );
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByPlaceholder("Filter by worker").fill("not-a-worker");
  await page.getByText("No matching blocks in this period.").waitFor();
  await page.getByRole("button", { name: "Close ledger" }).click();
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await page.getByRole("button", { name: "7d", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector(".suite-total")?.textContent?.includes("1,"),
  );
  await page.getByRole("button", { name: "Rusty Kaspad", exact: true }).click();
  await page.getByText("Synced", { exact: true }).waitFor();
  await page.locator(".suite-dag g[role=button]").first().click();
  await page.getByText("Block inspector", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Miners", exact: true }).click();
  await page.getByLabel("Sort miners").selectOption("name");
  assert.match(await page.locator(".miners-directory tbody tr").first().innerText(), /KS0-Ultra/);
  assert.equal(await page.locator(".miners-directory meter").count(), 2);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Download backup" }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  await downloadPromise;
  await page.getByRole("button", { name: "Save and restart bridge" }).click();
  await page.getByText("Settings operation completed successfully.").waitFor();
  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await page.getByRole("button", { name: "Pause logs" }).click();
  await page.getByRole("button", { name: "Resume logs" }).click();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  assert.equal((await page.request.post("http://localhost:3100/api/manager/bridge/restart", {headers:{origin:"null"}})).status(),403);
  assert.equal((await page.request.post("http://localhost:3100/api/manager/statistics/reset", {data:{padding:"x".repeat(17000)}})).status(),413);
  await page.route("**/api/manager/rewards/summary?*", route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Simulated outage"})}));
  await page.getByRole("button",{name:"Refresh",exact:true}).click();
  await page.getByText(/Refresh unavailable: Simulated outage/).waitFor();
  await page.unroute("**/api/manager/rewards/summary?*");
  await page.getByRole("button",{name:"Refresh",exact:true}).click();
  await page.getByText(/Refresh unavailable: Simulated outage/).waitFor({state:"hidden"});
  await page.locator(".suite-analytics > article tbody tr").first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${output}/stratum-analytics-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile page must not overflow horizontally",
  );
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({
    path: `${output}/stratum-overview-light.png`,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: desktop/mobile, themes, ledger, filters, periods, DAG inspector, backup, settings operation and logs.",
  );
} finally {
  await browser.close();
}

