import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import { createManager } from "./manager.mjs";

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));

test("reports a reachable Umbrel node and bridge API", async (t) => {
  const node = net.createServer(); const nodePort = await listen(node);
  const bridge = http.createServer((req,res) => {
    res.setHeader("content-type","application/json");
    res.end(req.url === "/api/stats" ? JSON.stringify({ activeWorkers: 2 }) : JSON.stringify({ kaspad_version: "2.0.1", instances: 1 }));
  });
  const bridgePort = await listen(bridge);
  const manager = createManager({
    listenHost:"127.0.0.1", listenPort:0, profile:"test",
    nodeEndpoint:{host:"127.0.0.1",port:nodePort}, bridgeApiUrl:`http://127.0.0.1:${bridgePort}`,
    bridgeCommand:"", bridgeArgs:[], bridgeWorkingDirectory:"", bridgeEnv:{},
    probeTimeoutMs:500, stopTimeoutMs:100, allowedOrigin:"http://localhost:3000",
  });
  const managerPort = await listen(manager.server);
  t.after(async()=>{await manager.close(); await close(manager.server); await close(bridge); await close(node);});
  const status = await fetch(`http://127.0.0.1:${managerPort}/api/manager/status`).then(r=>r.json());
  assert.equal(status.healthy,true); assert.equal(status.node.reachable,true);
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
