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
  assert.match(html, /src="\/kaspa-logo\.svg"/i);
  assert.match(html, />Stratum Manager<\/small>/i);
  assert.doesNotMatch(html, /codex-preview/i);
});

test("dashboard source contains no representative mining records", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ks5-pro-01|ks3m-shed|ks0-office/);
  assert.match(source, /No live miner data/);
  assert.match(source, /Miner hashrate/);
  assert.match(source, /Live session/);
  assert.match(source, /combinedMinerHashrate/);
  assert.doesNotMatch(source, /\["Network hashrate"/);
  assert.match(source, /control\(running\?"restart":"start"\)/);
  assert.match(source, /running\?"Restart":"Start"/);
  assert.match(source, /Automatic is recommended for most miners/);
  assert.match(source, /Save and restart bridge/);
  assert.match(source, /Saving briefly interrupts miners/);
  assert.match(source, /previous working settings are restored automatically/);
  assert.match(source, /Umbrel node connection is protected/);
  assert.match(source, /No wallet or credentials/);
  assert.match(source, /aria-label="Stratum port"[^>]*disabled readOnly/);
});
