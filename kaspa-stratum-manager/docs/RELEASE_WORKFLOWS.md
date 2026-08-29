# Fast Push and Slow Push

The public repository has two manual GitHub Actions workflows. Neither runs
automatically when source is committed. This prevents an ordinary development
change from starting the full Rust release build.

## Fast Push — normal development testing

Use **Fast Push - Umbrel Test** for dashboard, manager, Settings, styling and
other changes that do not alter the Rusty Kaspa bridge binary or its build.

Fast Push performs only these gates:

1. Check out the sanitized public source.
2. Reject private addresses, wallet addresses, credentials and key material.
3. Rebuild the Node application while reusing the bridge and runtime from the
   last immutable full release.
4. Publish the mutable `fast` image tag and capture its immutable digest.
5. Pin that digest into both Umbrel services, increment the patch version and
   push the test package to `main`.

The Docker build itself remains the compile check. Unit tests, lint, SBOM,
provenance, full Rust compilation and release-document updates are deliberately
excluded. GitHub Actions cache is scoped to Fast Push and an in-progress Fast
Push is cancelled when a newer one starts.

After it completes, refresh the Community App Store on Umbrel and update the
app. The manifest patch version increases on every Fast Push so Umbrel sees a
new test package.

Do not use Fast Push when changing the Rust bridge version, Rust toolchain,
Docker runtime, dependency lockfile, persistent-data contract, ports, Umbrel
service wiring or security boundary.

## Slow Push — full release gate

Use **Slow Push - Full Release** only for a major milestone or for any change
excluded from Fast Push. Enter the intended semantic version and type
`SLOW PUSH` as explicit confirmation.

Slow Push installs dependencies, runs the production build, all tests, lint,
packaging validation and the public-safety scan, compiles the pinned Rust
bridge, creates provenance and an SBOM, publishes the versioned linux/amd64
image, pins its immutable digest, and updates the base used by future Fast
Pushes.

Physical Umbrel and miner validation remains a separate manual acceptance gate.
Neither workflow may claim it passed.

## Source boundary

Development remains authoritative in the private repository. Before either
workflow is dispatched, export only the intended sanitized source to this
public repository. Fast Push is faster because it reduces build scope, not
because it relaxes the private/public boundary.
