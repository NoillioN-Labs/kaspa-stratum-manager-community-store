# Private installation on x86_64 Umbrel

This runbook installs the development package privately on an x86_64 umbrelOS
computer beside the official Rusty Kaspad app. It follows Umbrel's physical
device app-testing workflow and is not a public App Store release procedure.

Do not paste private LAN addresses, wallet addresses, passwords, tokens, seed
phrases or other secrets into this repository, command transcripts, issues or
pull requests. Use `umbrel.local` where mDNS works and enter the Umbrel password
only at an interactive prompt.

## Preconditions

- Rusty Kaspad is installed, running and synchronized.
- The target is reachable as `umbrel.local` from the development computer.
- The branch `session-2-management-api` is checked out in a trusted local
  working copy.
- The working tree contains no `.env.local`, credentials or other private
  files intended for transfer.
- TCP 5555 is available on the Umbrel host and is not forwarded by the router.

## 1. Verify the target interactively

From the development computer:

```sh
ssh umbrel@umbrel.local
uname -m
umbreld client apps.list.query
exit
```

Continue only when `uname -m` reports `x86_64` and the app list confirms
`rusty-kaspad` is installed. Do not save the password in a command, script or
environment file.

## 2. Run the local release gates

From the repository root:

```sh
npm ci
npm test
npm run lint
docker buildx build --platform linux/amd64 \
  -t kaspa-stratum-manager:0.2.0 --load .
```

The Docker build is expected to be cacheable after the completed Windows
validation. Record only pass/fail and public image metadata; do not capture
environment dumps.

## 3. Locate the Umbrel app-store directory

Open an interactive SSH session and verify the directory printed by this
command before copying anything:

```sh
find /home/umbrel/umbrel/app-stores -maxdepth 1 -type d \
  -name 'getumbrel-umbrel-apps-*' -print
```

Umbrel's official testing guide uses the matching
`getumbrel-umbrel-apps-<installation-id>` directory. Treat the installation ID
as local machine metadata and do not commit it.

## 4. Copy a clean package

From a shell with `rsync`, replace `<LOCAL_REPOSITORY>` and
`<UMBREL_APP_STORE>` interactively. Do not put the resolved values in tracked
files.

```sh
rsync -av --delete \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='.next' \
  --exclude='.wrangler' \
  --exclude='dist' \
  --exclude='node_modules' \
  --exclude='outputs' \
  --exclude='work' \
  <LOCAL_REPOSITORY>/ \
  umbrel@umbrel.local:<UMBREL_APP_STORE>/kaspa-stratum-manager/
```

Review the transfer list before entering the password. The destination must be
the verified Umbrel app-store directory, never the Umbrel root or a data
directory.

## 5. Install through umbreld

In an interactive SSH session:

```sh
umbreld client apps.install.mutate --appId kaspa-stratum-manager
```

The current private package contains build instructions, so umbreld's Compose
startup builds the local `linux/amd64` image from the copied source. The Rust
stage can take substantial time on the first build. Keep the SSH session open
and do not interrupt a healthy build.

If installation fails, capture only the relevant error lines. Redact private
addresses, credentials and wallet information before adding any diagnostic to
GitHub.

## 6. Post-install acceptance

After Umbrel reports success:

1. Open `http://umbrel.local:5556` and confirm Umbrel App Proxy requires the
   normal Umbrel sign-in.
2. Confirm the GUI loads and reports the node connected and synchronized.
3. Confirm the bridge is running and the status/statistics views load.
4. Confirm the dashboard shows zero miners honestly when no miner is connected.
5. Confirm TCP 5555 is reachable from the private LAN only.
6. Use the GUI to stop, start and restart the bridge, confirming recovery after
   every action.
7. Restart the app from Umbrel and confirm the bridge returns healthy.
8. Confirm `/data/config.yaml` persists across the restart.

Do not connect an ASIC until all eight checks pass.

## 7. Evidence to record

Commit only non-sensitive results:

- umbrelOS version;
- target architecture (`x86_64`);
- app version and Git commit;
- build and install pass/fail;
- GUI, node, bridge API, statistics and Stratum pass/fail;
- lifecycle and persistence pass/fail;
- sanitized error summaries when needed.

Never record host addresses, wallet addresses, credentials, secrets, container
environment dumps or raw configuration containing private values.

## Rollback

If the private app causes a problem, stop or uninstall only this app through the
Umbrel UI. The command-line uninstall is:

```sh
umbreld client apps.uninstall.mutate --appId kaspa-stratum-manager
```

Umbrel removes app data during uninstall. Preserve any required sanitized
diagnostic evidence before uninstalling. Do not remove or modify Rusty Kaspad.
