"use client";
import { useState } from "react";
import { readApi, useLive } from "./use-live";
type DagBlock = {
  hash: string;
  parents: string[];
  daaScore: string | null;
  blueScore: string | null;
  timestamp: string | null;
  color: string;
  chain: boolean;
};
type NodeSnapshot = {
  connected: boolean;
  error: string | null;
  checkedAt: string | null;
  info: {
    serverVersion: string;
    networkId: string;
    isSynced: boolean;
    virtualDaaScore: string;
    blockCount: string;
    headerCount: string;
    difficulty: number;
    peerCount: number;
    tipCount: number;
  } | null;
  blocks: DagBlock[];
};

export function GhostDag({
  base,
  full = false,
}: {
  base: string;
  full?: boolean;
}) {
  const [paused, setPaused] = useState(false),
    [selected, setSelected] = useState<DagBlock | null>(null),
    [extra, setExtra] = useState<DagBlock[]>([]),
    [error, setError] = useState(""),
    [expanding, setExpanding] = useState(false);
  const live = useLive<NodeSnapshot>(`${base}/api/manager/node`, 2000, !paused);
  const blocks = [
    ...new Map(
      [...(live.data?.blocks ?? []), ...extra].map((b) => [b.hash, b]),
    ).values(),
  ].slice(-(full ? 160 : 64));
  const ordered = [...blocks].sort((a, b) =>
    BigInt(a.daaScore ?? "0") < BigInt(b.daaScore ?? "0")
      ? -1
      : BigInt(a.daaScore ?? "0") > BigInt(b.daaScore ?? "0")
        ? 1
        : a.hash.localeCompare(b.hash),
  );
  const scores = [...new Set(ordered.map((b) => b.daaScore ?? "0"))];
  const positions = new Map(
    ordered.map((b) => {
      const column = scores.indexOf(b.daaScore ?? "0"),
        siblings = ordered.filter((n) => n.daaScore === b.daaScore),
        row = siblings.indexOf(b);
      return [
        b.hash,
        {
          x: 35 + (column / Math.max(1, scores.length - 1)) * 930,
          y: 35 + ((row + 1) / (siblings.length + 1)) * 210,
        },
      ];
    }),
  );
  const expand = async () => {
    if (!selected) return;
    setExpanding(true);
    try {
      const results = await Promise.all(
        selected.parents
          .slice(0, 8)
          .map((h) => readApi<DagBlock>(`${base}/api/manager/node/block/${h}`)),
      );
      setExtra((old) => [...old, ...results.filter(Boolean)].slice(-80));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parents unavailable");
    } finally {
      setExpanding(false);
    }
  };
  return (
    <section className="suite-card suite-dag">
      <div className="suite-card-head">
        <div>
          <span className="suite-kicker">EXTERNAL RUSTY KASPAD</span>
          <h3>Live GhostDAG</h3>
        </div>
        <div>
          <span
            className={`suite-state ${live.data?.connected && !live.error ? "blue" : "error"}`}
          >
            {paused
              ? "Paused"
              : live.data?.connected && !live.error
                ? "Connected"
                : "Reconnecting"}
          </span>
          <button onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
      {(live.error || live.data?.error || error) && (
        <p role="status" className="suite-warning">
          {live.error || live.data?.error || error}
        </p>
      )}
      {blocks.length ? (
        <svg
          viewBox="0 0 1000 300"
          role="group"
          aria-label="Live GhostDAG. Select a block to inspect its hash and parents."
        >
          {ordered.flatMap((b) =>
            b.parents.map((parent) => {
              const from = positions.get(parent),
                to = positions.get(b.hash);
              return from && to ? (
                <line
                  key={`${b.hash}-${parent}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="var(--line)"
                  strokeWidth="1.5"
                />
              ) : null;
            }),
          )}
          {ordered.map((b) => {
            const p = positions.get(b.hash)!;
            return (
              <g
                key={b.hash}
                role="button"
                tabIndex={0}
                aria-label={`${b.color} block ${b.hash}`}
                onClick={() => setSelected(b)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(b);
                  }
                }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={selected?.hash === b.hash ? 9 : 6}
                  fill={
                    b.color === "blue"
                      ? "#70c7ba"
                      : b.color === "red"
                        ? "#ef8b91"
                        : "#8d9aa9"
                  }
                  stroke={b.chain ? "#55c7e8" : "transparent"}
                  strokeWidth="3"
                />
                <title>
                  {b.hash} · DAA {b.daaScore} · {b.color}
                </title>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="suite-empty">
          Waiting for block notifications from your Rusty Kaspad node.
        </div>
      )}
      <div className="suite-toolbar">
        <small>
          ● Blue &nbsp; <span className="suite-red">● Red</span> &nbsp; ●
          Unresolved · Cyan outline: selected chain
        </small>
        <small>{blocks.length} blocks shown · Colours from node evidence</small>
      </div>
      {selected && (
        <div className="suite-inspector">
          <div className="suite-card-head">
            <h3>Block inspector</h3>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
          <code className="suite-hash">{selected.hash}</code>
          <p>
            DAA {selected.daaScore ?? "—"} · Blue score{" "}
            {selected.blueScore ?? "—"} · {selected.color}
          </p>
          <button
            disabled={expanding || !selected.parents.length}
            onClick={expand}
          >
            {expanding ? "Loading…" : "Expand parents"}
          </button>
          <small>Up to eight parents per request</small>
        </div>
      )}
    </section>
  );
}

export default function NodeView({ base }: { base: string }) {
  const live = useLive<NodeSnapshot>(`${base}/api/manager/node`, 10000),
    info = live.data?.info;
  return (
    <section className="suite-analytics">
      <div className="suite-toolbar">
        <div>
          <span className="suite-kicker">YOUR EXISTING NODE</span>
          <h2>Rusty Kaspad</h2>
        </div>
        <span className="suite-badge">External dependency</span>
      </div>
      {(live.error || live.data?.error) && (
        <p className="suite-warning">{live.error || live.data?.error}</p>
      )}
      <div className="suite-stats">
        {[
          ["Version", info?.serverVersion],
          ["Network", info?.networkId],
          ["Sync", info ? (info.isSynced ? "Synced" : "Syncing") : null],
          ["Peers", info?.peerCount],
          ["DAA score", info?.virtualDaaScore],
          ["Blocks", info?.blockCount],
          ["Headers", info?.headerCount],
          ["Tips", info?.tipCount],
        ].map(([k, v]) => (
          <article key={k} className="suite-card">
            <span>{k}</span>
            <strong>{v ?? "—"}</strong>
          </article>
        ))}
      </div>
      <GhostDag base={base} full />
      <p>
        Manage or restart Rusty Kaspad from its separate Umbrel app. Bridge
        controls affect only this mining app.
      </p>
    </section>
  );
}
