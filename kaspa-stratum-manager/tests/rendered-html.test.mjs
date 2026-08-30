import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders Kaspa Stratum Manager metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Kaspa Stratum Manager<\/title>/i);
  assert.match(html, /<link[^>]+rel="(?:shortcut )?icon"[^>]+href="\/favicon\.svg"/i);
  assert.match(html, /src="\/kaspa-logo\.svg"/i);
  assert.match(html, />Stratum Bridge Manager<\/small>/i);
  assert.doesNotMatch(html, /codex-preview/i);
});

test("dashboard source contains no representative mining records", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /representative(?:Workers|Miners)|sample(?:Workers|Miners)/i);
  assert.match(source, /No live miner data/);
  assert.match(source, /Miner hashrate/);
  assert.match(source, /historyAverage/);
  assert.match(source, /Live average/);
  assert.match(source, /120 readings/);
  assert.match(source, /5 sec each/);
  assert.match(source, /setInterval\(refresh,5000\)/);
  assert.match(source, /combinedMinerHashrate/);
  assert.match(source, /workers\.slice\(0,5\)/);
  assert.match(source, /Showing up to 5 miners/);
  assert.match(source, /App version/);
  assert.match(source, /Bridge version/);
  assert.match(source, /Developed by/);
  assert.match(source, />NoillioN Labs</);
  assert.match(source, /Support development/);
  assert.match(source, /api\/manager\/support/);
  assert.match(source, /copy it manually/);
  assert.doesNotMatch(source, /Copy address|Open wallet|navigator\.clipboard/);
  assert.match(source, /system-health/);
  assert.match(source, /Mining gateway is online/);
  assert.doesNotMatch(source, /\["Network hashrate"/);
  assert.match(source, /control\(running\?"restart":"start"\)/);
  assert.match(source, /running\?"Restart":"Start"/);
  assert.match(source, /Automatic is recommended for most miners/);
  assert.match(source, /Save and restart bridge/);
  assert.match(source, /Saving briefly interrupts miners/);
  assert.match(source, /previous working settings are restored automatically/);
  assert.match(source, /Umbrel node connection is protected/);
  assert.match(source, /No wallet or credentials/);
  assert.match(source, /miners-page/);
  assert.match(source, /Miner directory/);
  assert.match(source, /Complete live worker list/);
  assert.match(source, /Live data refreshes every 5 seconds/);
  assert.match(source, /Connect miners to your Umbrel/);
  assert.match(source, /Blocks found/);
  assert.match(source, /Last block/);
  assert.match(source, /blocks are confirmed by your node/i);
  assert.match(source, /confirms them blue/);
  assert.match(source, /worker\.blocks/);
  assert.match(source, /stats\?\.blocks/);
  assert.match(source, /api\/manager\/history/);
  assert.match(source, /7-day block outlook/);
  assert.match(source, /Chance in next 7 days/);
  assert.match(source, /Estimated average wait/);
  assert.match(source, /Average network hashrate/);
  assert.match(source, /Network blocks observed/);
  assert.match(source, /Per-miner 7-day outlook/);
  assert.match(source, /Probability estimate/i);
  assert.match(source, /not a promise/i);
  assert.match(source, /Live application logs/);
  assert.match(source, /api\/manager\/logs\?limit=200/);
  assert.match(source, /Newest messages appear first/);
  assert.match(source, /Kept in memory only/);
  assert.match(source, /aria-label="Search logs"/);
  assert.match(source, /Everything is ready for mining/);
  assert.match(source, /Live service checks/);
  assert.match(source, /Stratum listener/);
  assert.match(source, /TCP port 5555/);
  assert.match(source, /Runtime details/);
  assert.match(source, /If something is not working/);
  assert.match(source, /aria-label="Stratum port"[^>]*disabled readOnly/);
  assert.match(source, /window\.location\.hostname/);
  assert.doesNotMatch(source, /umbrel\.local/i);
});
