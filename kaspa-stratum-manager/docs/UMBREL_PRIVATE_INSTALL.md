# Milestone installation on x86_64 Umbrel

This runbook installs a sanitized public milestone on an x86_64 umbrelOS
computer beside the official Rusty Kaspad app. The authoritative development
repository remains private; testable milestones are periodically exported to:

https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

Do not paste private LAN addresses, wallet addresses, passwords, tokens, seed
phrases or other secrets into either repository, command transcripts, issues or
pull requests.

## Preconditions

- Rusty Kaspad is installed, running and synchronized.
- The Umbrel computer is x86_64.
- TCP 5555 is available on the Umbrel host and is not forwarded by the router.
- The public repository shows the intended milestone before installation.

## 1. Add the Community App Store

In the Umbrel web interface:

1. Open **App Store**.
2. Open **Community App Stores**.
3. Choose **Add**.
4. Enter this repository URL:

       https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

5. Wait for the **NoillioN Labs** store to appear.

This route uses only the public sanitized snapshot. It does not give Umbrel
access to the private development repository and requires no GitHub credential
or SSH key.

## 2. Install the milestone

Open the NoillioN Labs store, select **Kaspa Solo Mining Console**, and choose
**Install**. Milestone `0.3.0` pulls a public linux/amd64 image pinned to an
immutable digest. Umbrel does not compile Rusty Kaspa locally during normal
installation or updates.

If installation fails, capture only the relevant error lines. Redact private
addresses, credentials and wallet information before adding diagnostics to
GitHub.

## 3. Post-install acceptance

After Umbrel reports success:

1. Open Kaspa Solo Mining Console from the Umbrel interface and confirm the normal
   Umbrel sign-in protects it.
2. Confirm the GUI loads and reports the node connected and synchronized.
3. Confirm the bridge is running and the status/statistics views load.
4. Confirm the dashboard shows zero miners honestly when none is connected.
5. Confirm TCP 5555 is reachable from the private LAN only.
6. Use the GUI to stop, start and restart the bridge, confirming recovery after
   every action.
7. Restart the app from Umbrel and confirm the bridge returns healthy.
8. Confirm `/data/config.yaml` persists across the restart.

For a Settings milestone, also open **Settings**, keep Automatic or choose the
curated IceRiver preset, and select **Save and restart bridge**. Expect a short
miner interruption. Confirm the success message appears, the bridge becomes
healthy, and the miner reconnects. Then restart the complete app and confirm
the selected settings, bridge health and miner connection return. If the GUI
reports an automatic rollback, record only the sanitized result and do not
claim persistence success.

Do not connect an ASIC until all eight checks pass.

## 4. Evidence to record

Commit only non-sensitive results:

- umbrelOS version;
- target architecture (`x86_64`);
- app version and public milestone commit;
- build and install pass/fail;
- GUI, node, bridge API, statistics and Stratum pass/fail;
- lifecycle and persistence pass/fail;
- sanitized error summaries when needed.

Never record host addresses, wallet addresses, credentials, secrets, container
environment dumps or raw configuration containing private values.

## Rollback

If the milestone causes a problem, stop or uninstall only Kaspa Solo Mining Console
through the Umbrel UI. Preserve any required sanitized diagnostic evidence
before uninstalling. Do not remove or modify Rusty Kaspad.
