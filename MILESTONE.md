# Kaspa Solo Mining Console 1.3.0 candidate

This sanitized source candidate adds realised Kaspa reward analytics, complete
Light and Dark themes, improved mobile layouts, runtime LAN connection guidance,
the refreshed Kaspa Solo Mining Console identity and the latest miner-statistics
controls.

The local production build, 36 automated tests, lint, packaging validation,
diff validation and sensitive-data scans pass. The release workflow must still
compile and execute the pinned bridge on native AMD64 and ARM64 runners, publish
one immutable multi-architecture digest and pin that digest into the Community
package.

Automated success does not constitute physical Umbrel validation. The exact
candidate must still be tested on the x86_64 Umbrel with the KS7 Lite
reconnecting and persisted settings, miner history, dashboard metrics and
reward history retained after restart. Physical ARM64 umbrelOS validation has
not been performed.
