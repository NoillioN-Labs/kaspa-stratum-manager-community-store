import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createManager } from "./manager.mjs";
import { AUTOMATIC_SETTINGS } from "./settings.mjs";

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));
const defaultYaml = `# manager_preset: automatic
kaspad_address: "host.docker.internal:16110"
print_stats: true
var_diff: true
shares_per_min: 30
pow2_clamp: true
extranonce_size: 2
unrelated_supported_option: 77
instances:
  - stratum_port: ":5555"
    min_share_diff: 2048
    prom_port: ":2114"
`;
const testConfig = (directory) => ({
  listenHost:"127.0.0.1", listenPort:0, profile:"test",
  nodeEndpoint:{host:"127.0.0.1",port:1}, bridgeApiUrl:"http://127.0.0.1:1",
  bridgeCommand:"fake", bridgeArgs:[], bridgeWorkingDirectory:"", bridgeEnv:{},
  probeTimeoutMs:50, stopTimeoutMs:50, allowedOrigin:"http://localhost:3000",
  settingsPath:path.join(directory,"config.yaml"),
  settingsBackupPath:path.join(directory,"config.last-good.yaml"),
  settingsHealthTimeoutMs:50, settingsHealthIntervalMs:1,
  historyPath:path.join(directory,"mining-history.json"),
  historyRetentionMs:7*24*60*60*1000, historySampleIntervalMs:60_000, historyFlushIntervalMs:300_000,
  metricsPath:path.join(directory,"dashboard-metrics.json"),
  metricsRetentionMs:10*60*1000, metricsSampleIntervalMs:5_000, metricsFlushIntervalMs:30_000,
});
const fakeSupervisor = (restart = async () => {}) => ({
  managed:true,
  state:()=>({managed:true,state:"running",uptime_seconds:1}),
  start:async()=>{}, stop:async()=>{}, restart,
});
const putSettings = (port, body) => fetch(`http://127.0.0.1:${port}/api/manager/settings`, {
  method:"PUT", headers:{"content-type":"application/json"}, body:JSON.stringify(body),
});

test("reports a reachable Umbrel node and bridge API", async (t) => {
  const node = net.createServer(); const nodePort = await listen(node);
  const stratum = net.createServer(); const stratumPort = await listen(stratum);
  const bridge = http.createServer((req,res) => {
    res.setHeader("content-type","application/json");
    res.end(req.url === "/api/stats" ? JSON.stringify({ activeWorkers: 2 }) : JSON.stringify({ kaspad_version: "2.0.1", instances: 1 }));
  });
  const bridgePort = await listen(bridge);
  const manager = createManager({
    listenHost:"127.0.0.1", listenPort:0, appVersion:"0.3.3", bridgeVersion:"2.0.1", profile:"test",
    nodeEndpoint:{host:"127.0.0.1",port:nodePort}, stratumEndpoint:{host:"127.0.0.1",port:stratumPort}, bridgeApiUrl:`http://127.0.0.1:${bridgePort}`,
    bridgeCommand:"", bridgeArgs:[], bridgeWorkingDirectory:"", bridgeEnv:{},
    probeTimeoutMs:500, stopTimeoutMs:100, allowedOrigin:"http://localhost:3000",
  });
  const managerPort = await listen(manager.server);
  t.after(async()=>{await manager.close(); await close(manager.server); await close(bridge); await close(stratum); await close(node);});
  const status = await fetch(`http://127.0.0.1:${managerPort}/api/manager/status`).then(r=>r.json());
  assert.equal(status.healthy,true); assert.equal(status.node.reachable,true);
  assert.equal(status.appVersion,"0.3.3");
  assert.equal(status.bridgeVersion,"2.0.1");
  assert.equal(status.stratum.reachable,true);
  assert.equal(status.stratum.port,stratumPort);
  assert.equal(status.bridge.api.status.kaspad_version,"2.0.1");
  const stats = await fetch(`http://127.0.0.1:${managerPort}/api/manager/stats`).then(r=>r.json());
  assert.equal(stats.activeWorkers,2);
});

test("blocks process controls in an unmanaged Windows profile", async (t) => {
  const manager = createManager({
    listenHost:"127.0.0.1", listenPort:0, profile:"windows-development",
    nodeEndpoint:{host:"127.0.0.1",port:1}, bridgeApiUrl:"http://127.0.0.1:1",
    bridgeCommand:"", bridgeArgs:[], bridgeWorkingDirectory:"", bridgeEnv:{},
    probeTimeoutMs:50, stopTimeoutMs:50, allowedOrigin:"http://localhost:3000",
  });
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response=await fetch(`http://127.0.0.1:${port}/api/manager/bridge/start`,{method:"POST"});
  assert.equal(response.status,409);
  assert.match((await response.json()).error,/disabled/);
});

test("returns bounded in-memory manager and bridge logs", async (t) => {
  const manager = createManager({
    listenHost:"127.0.0.1", listenPort:0, profile:"test",
    nodeEndpoint:{host:"127.0.0.1",port:1}, bridgeApiUrl:"http://127.0.0.1:1",
    bridgeCommand:"", bridgeArgs:[], bridgeWorkingDirectory:"", bridgeEnv:{},
    probeTimeoutMs:50, stopTimeoutMs:50, allowedOrigin:"http://localhost:3000",
  });
  manager.logs.add("manager","Manager ready");
  manager.logs.add("bridge","Worker connected\nShare accepted");
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response=await fetch(`http://127.0.0.1:${port}/api/manager/logs?limit=2`);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.lines.length,2);
  assert.deepEqual(body.lines.map(({source,line})=>({source,line})),[
    {source:"bridge",line:"Worker connected"},
    {source:"bridge",line:"Share accepted"},
  ]);
  assert.ok(body.lines.every(({timestamp})=>!Number.isNaN(Date.parse(timestamp))));
});

test("returns only validated public donation addresses", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-manager-support-"));
  const config = testConfig(directory);
  config.donationKaspaAddress = "kaspa:" + "q".repeat(61);
  config.donationBitcoinAddress = "bc1q" + "q".repeat(38);
  const manager = createManager(config, { supervisor:fakeSupervisor() });
  const port = await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response=await fetch(`http://127.0.0.1:${port}/api/manager/support`);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.enabled,true);
  assert.deepEqual(body.currencies.map(({id})=>id),["kaspa","bitcoin"]);
  assert.deepEqual(Object.keys(body.currencies[0]).sort(),["address","id","label"]);
  assert.deepEqual(Object.keys(body.currencies[1]).sort(),["address","id","label"]);
});

test("hides malformed donation configuration", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-manager-support-invalid-"));
  const config = testConfig(directory);
  config.donationKaspaAddress = "not-an-address";
  config.donationBitcoinAddress = "not-an-address";
  const manager = createManager(config, { supervisor:fakeSupervisor() });
  const port = await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const body=await fetch(`http://127.0.0.1:${port}/api/manager/support`).then(response=>response.json());
  assert.deepEqual(body,{enabled:false,currencies:[]});
});

test("returns sanitized durable mining history and block outlook", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-manager-history-"));
  const manager = createManager(testConfig(directory), { supervisor:fakeSupervisor() });
  const started = Date.now()-60_000;
  const first = {networkHashrate:1e12,networkBlockCount:100,workers:[{instance:"5555",worker:"RIG01",wallet:"private",hashrate:10}],blocks:[]};
  const second = {networkHashrate:1e12,networkBlockCount:101,workers:[{instance:"5555",worker:"RIG01",wallet:"private",hashrate:10}],blocks:[{instance:"5555",worker:"RIG01",wallet:"private",hash:"block-a",timestamp:String((started+60_000)/1000)}]};
  await manager.history.record(first,started);
  await manager.history.record(second,started+60_000);
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response=await fetch(`http://127.0.0.1:${port}/api/manager/history`);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.blocksFound,1);
  assert.equal(body.workers[0].worker,"RIG01");
  assert.equal(body.workers[0].blocksFound,1);
  assert.ok(body.expectedBlocksNextWindow>0);
  assert.ok(body.periods.oneHour);
  assert.ok(body.periods.sixHours);
  assert.ok(body.periods.twentyFourHours);
  assert.ok(body.periods.sevenDays);
  assert.ok(Array.isArray(body.charts.oneHour));
  assert.equal(body.recentBlocks.length,1);
  assert.equal(body.recentBlocks[0].worker,"RIG01");
  assert.equal(body.recentBlocks[0].networkBlockCount,101);
  assert.equal(Object.hasOwn(body.recentBlocks[0],"hash"),false);
  assert.doesNotMatch(JSON.stringify(body),/wallet|private|block-a/);
});

test("requires confirmation and resets all retained miner statistics", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-manager-reset-"));
  const manager = createManager(testConfig(directory), { supervisor:fakeSupervisor() });
  const started = Date.now()-60_000;
  await manager.history.record({networkHashrate:1e12,networkBlockCount:100,workers:[{worker:"RIG01",hashrateGhs:1000}]},started);
  await manager.history.record({networkHashrate:1e12,networkBlockCount:101,workers:[{worker:"RIG01",hashrateGhs:1000}],blocks:[{worker:"RIG01",hash:"block-reset"}]},started+60_000);
  await manager.metrics.record({activeWorkers:1,totalShares:42,workers:[{hashrateGhs:1000}]},started+60_000);
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});

  const rejected=await fetch(`http://127.0.0.1:${port}/api/manager/statistics/reset`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({})});
  assert.equal(rejected.status,400);
  const response=await fetch(`http://127.0.0.1:${port}/api/manager/statistics/reset`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({confirmation:"DELETE MINER STATISTICS"})});
  assert.equal(response.status,200);
  assert.equal((await response.json()).result,"reset");
  const history=await manager.history.summary();
  const metrics=await manager.metrics.summary();
  assert.equal(history.sampleCount,0);
  assert.equal(history.blocksFound,0);
  assert.deepEqual(history.workers,[]);
  assert.equal(metrics.acceptedSharesTotal,0);
  assert.deepEqual(metrics.samples,[]);
});

test("returns persistent rolling dashboard metrics without private worker data", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-manager-metrics-"));
  const manager = createManager(testConfig(directory), { supervisor:fakeSupervisor() });
  await manager.metrics.record({
    activeWorkers:1,
    totalShares:42,
    workers:[{worker:"RIG01",wallet:"private",hashrateGhs:4120}],
  }, Date.now());
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response=await fetch(`http://127.0.0.1:${port}/api/manager/metrics`);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.acceptedSharesTotal,42);
  assert.equal(body.samples.length,1);
  assert.equal(body.samples[0].hashrateHs,4.12e12);
  assert.equal(body.samples[0].connectedMiners,1);
  assert.doesNotMatch(JSON.stringify(body),/wallet|private|RIG01/);
});

test("reads only the sanitized settings model", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-settings-read-"));
  await writeFile(path.join(directory,"config.yaml"), defaultYaml);
  const manager = createManager(testConfig(directory), { supervisor:fakeSupervisor(), waitForBridgeHealthy:async()=>true });
  const port = await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response = await fetch(`http://127.0.0.1:${port}/api/manager/settings`);
  const body = await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(body.settings,AUTOMATIC_SETTINGS);
  assert.equal(body.protected.nodeConnection,"Managed by Umbrel");
  assert.equal(body.protected.credentialsStored,false);
  assert.doesNotMatch(JSON.stringify(body),/host\.docker\.internal|kaspad_address|unrelated_supported_option/);
});

test("rejects unknown fields, invalid ports, non-power-of-two difficulty, and incompatible tuning", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-settings-invalid-"));
  await writeFile(path.join(directory,"config.yaml"), defaultYaml);
  let restarts=0;
  const manager = createManager(testConfig(directory), { supervisor:fakeSupervisor(async()=>{restarts+=1;}), waitForBridgeHealthy:async()=>true });
  const port = await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response = await putSettings(port,{...AUTOMATIC_SETTINGS,preset:"custom",stratumPort:80,minimumShareDifficulty:3000,powerOfTwoClamp:false,wallet:"forbidden"});
  const body = await response.json();
  assert.equal(response.status,400);
  assert.equal(body.error,"Settings validation failed");
  assert.deepEqual(new Set(body.issues.map(({field})=>field)),new Set(["wallet","stratumPort","minimumShareDifficulty","powerOfTwoClamp"]));
  assert.equal(restarts,0);
  assert.equal(await readFile(path.join(directory,"config.yaml"),"utf8"),defaultYaml);
});

test("atomically persists approved settings, preserves unrelated configuration, backs up, and restarts", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-settings-save-"));
  await writeFile(path.join(directory,"config.yaml"), defaultYaml);
  let restarts=0;
  const manager = createManager(testConfig(directory), { supervisor:fakeSupervisor(async()=>{restarts+=1;}), waitForBridgeHealthy:async()=>true });
  const port = await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const settings={...AUTOMATIC_SETTINGS,preset:"custom",sharesPerMinute:20,minimumShareDifficulty:4096};
  const response=await putSettings(port,settings); const body=await response.json();
  assert.equal(response.status,200); assert.equal(body.result,"saved"); assert.equal(body.bridgeRestarted,true);
  assert.equal(restarts,1);
  assert.equal(await readFile(path.join(directory,"config.last-good.yaml"),"utf8"),defaultYaml);
  const saved=await readFile(path.join(directory,"config.yaml"),"utf8");
  assert.match(saved,/kaspad_address: "host\.docker\.internal:16110"/);
  assert.match(saved,/unrelated_supported_option: 77/);
  assert.match(saved,/stratum_port: ":5555"/);
  assert.match(saved,/min_share_diff: 4096/);
});

test("serializes concurrent settings updates", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-settings-concurrent-"));
  await writeFile(path.join(directory,"config.yaml"), defaultYaml);
  let active=0; let maximum=0; let restarts=0;
  const manager=createManager(testConfig(directory),{
    supervisor:fakeSupervisor(async()=>{restarts+=1;}),
    waitForBridgeHealthy:async()=>{active+=1;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,15));active-=1;return true;},
  });
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const first=putSettings(port,{...AUTOMATIC_SETTINGS,preset:"custom",sharesPerMinute:20});
  const second=putSettings(port,{...AUTOMATIC_SETTINGS,preset:"custom",sharesPerMinute:40});
  const responses=await Promise.all([first,second]);
  assert.deepEqual(responses.map(({status})=>status),[200,200]);
  assert.equal(maximum,1); assert.equal(restarts,2);
  assert.match(await readFile(path.join(directory,"config.yaml"),"utf8"),/shares_per_min: 40/);
});

test("restores the last-known-good file and restarts after a failed new configuration", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-settings-rollback-"));
  await writeFile(path.join(directory,"config.yaml"), defaultYaml);
  let restarts=0; let checks=0;
  const manager=createManager(testConfig(directory),{
    supervisor:fakeSupervisor(async()=>{restarts+=1;}),
    waitForBridgeHealthy:async()=>{checks+=1;if(checks===1)throw new Error("new bridge unhealthy");return true;},
  });
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response=await putSettings(port,{...AUTOMATIC_SETTINGS,preset:"custom",minimumShareDifficulty:4096});
  const body=await response.json();
  assert.equal(response.status,503); assert.equal(body.result,"rolled_back");
  assert.deepEqual(body.rollback,{restored:true,restarted:true,healthy:true,error:null});
  assert.equal(restarts,2); assert.equal(checks,2);
  assert.equal(await readFile(path.join(directory,"config.yaml"),"utf8"),defaultYaml);
  assert.equal(await readFile(path.join(directory,"config.last-good.yaml"),"utf8"),defaultYaml);
});

test("reports rollback recovery failure after restart failure", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-settings-restart-failure-"));
  await writeFile(path.join(directory,"config.yaml"), defaultYaml);
  let restarts=0;
  const manager=createManager(testConfig(directory),{
    supervisor:fakeSupervisor(async()=>{restarts+=1;throw new Error(restarts===1?"restart failed":"rollback restart failed");}),
    waitForBridgeHealthy:async()=>true,
  });
  const port=await listen(manager.server);
  t.after(async()=>{await manager.close();await close(manager.server);});
  const response=await putSettings(port,{...AUTOMATIC_SETTINGS,preset:"custom",minimumShareDifficulty:4096});
  const body=await response.json();
  assert.equal(response.status,503); assert.equal(body.result,"rolled_back");
  assert.equal(body.rollback.restored,true); assert.equal(body.rollback.restarted,false); assert.equal(body.rollback.healthy,false);
  assert.match(body.rollback.error,/rollback restart failed/);
  assert.equal(await readFile(path.join(directory,"config.yaml"),"utf8"),defaultYaml);
});
