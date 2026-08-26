# Windows 11 development with a separate Umbrel computer

The development computer runs the dashboard and manager. Rusty Kaspad remains
on the Umbrel computer on the same LAN.

## 1. Confirm name resolution and RPC reachability

```powershell
ping umbrel.local
Test-NetConnection umbrel.local -Port 16110
```

If `umbrel.local` does not resolve, use the Umbrel computer's reserved LAN IP
address instead.

## 2. Configure the manager

```powershell
Copy-Item .env.example .env.local
```

Set `KASPA_NODE_GRPC` to `umbrel.local:16110` or `<UMBrel-IP>:16110`.
Do not add GitHub credentials, wallet seeds or private keys to this file.

## 3. Run the manager

```powershell
npm run manager:dev
```

Open `http://127.0.0.1:8081/api/manager/status` to inspect the connection.

The Windows profile does not manage a bridge process unless
`BRIDGE_COMMAND` is explicitly configured. This prevents development actions
from stopping or restarting a production bridge on Umbrel.

## 4. Run the dashboard

Keep the manager running. In a second PowerShell window, run:

```powershell
Set-Location C:\KaspaDev\kaspa-stratum-manager
npm run dev
```

Open `http://localhost:3000`. The dashboard should report the configured Rusty
Kaspad endpoint as connected. It is expected to report the bridge as stopped
until the bridge executable is installed and configured.

## Production difference

Inside Umbrel, `KASPA_NODE_GRPC` is `host.docker.internal:16110`, and the
manager supervises the bridge binary packaged in its own application container.
