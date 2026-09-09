"use client";
import { useId, useState } from "react";
import Estimates from "./estimates";
import { useLive } from "./use-live";

type Block = {
  hash: string;
  worker: string;
  timestamp: string;
  rewardStatus: string;
  confirmationCount: string | null;
  totalRewardSompi: string | null;
};
type Summary = {
  periodSeconds: number;
  asOf: string;
  blocksFound: number;
  blueBlocks: number;
  redBlocks: number;
  pendingBlocks: number;
  errorBlocks: number;
  subsidySompi: string;
  acceptedTxFeesSompi: string;
  dagMergeRewardSompi: string;
  totalRewardSompi: string;
  decompositionCoverage: number | null;
  daily: { timestamp: string; blocks: number; totalRewardSompi: string }[];
};
type Ledger = { blocks: Block[]; total: number; nextCursor: string | null };
const periods = ["1h", "6h", "24h", "7d", "lifetime"];
export const kas = (value?: string | null) => {
  if (value === null || value === undefined) return "—";
  const n = BigInt(value);
  return `${(n / 100000000n).toLocaleString()}.${(n % 100000000n).toString().padStart(8, "0").replace(/0+$/, "") || "0"}`;
};
const ratio = (n: bigint, d: bigint) =>
  d > 0n ? Number((n * 10000n) / d) / 10000 : 0;
const label = (status: string) =>
  status === "pending" || status === "unknown" || status === "unresolved"
    ? "Pending"
    : status === "error"
      ? "Retrying"
      : status === "blue"
        ? "Blue"
        : "Red";

function chartPoints(summary: Summary) {
  let cumulative = 0n;
  const total = BigInt(summary.totalRewardSompi);
  const start = Date.parse(summary.daily[0]?.timestamp ?? summary.asOf),
    end = Date.parse(summary.asOf);
  return summary.daily.map((b) => {
    cumulative += BigInt(b.totalRewardSompi);
    return {
      ...b,
      value: cumulative,
      x:
        35 +
        ((Date.parse(b.timestamp) - start) / Math.max(1, end - start)) * 630,
      y: 185 - ratio(cumulative, total) * 145,
    };
  });
}
function RewardChart({ summary }: { summary: Summary }) {
  const id = useId().replaceAll(":", "");
  const points = chartPoints(summary);
  const line = `M35 185 ${points.map((p) => `H${p.x} V${p.y}`).join(" ")} H665`;
  return (
    <div className="suite-chart">
      <svg
        viewBox="0 0 700 225"
        role="img"
        aria-label={`Cumulative realised rewards: ${kas(summary.totalRewardSompi)} KAS from the complete selected period`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#70c7ba" stopOpacity=".35" />
            <stop offset="1" stopColor="#70c7ba" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 88, 136, 185].map((y) => (
          <line
            key={y}
            x1="35"
            x2="665"
            y1={y}
            y2={y}
            className="suite-gridline"
          />
        ))}
        <path d={`${line} V185 H35 Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="#70c7ba" strokeWidth="3" />
        {points.map((p) => (
          <circle key={p.timestamp} cx={p.x} cy={p.y} r="3" fill="#70c7ba">
            <title>
              {new Date(p.timestamp).toLocaleString()} ·{" "}
              {kas(p.value.toString())} KAS
            </title>
          </circle>
        ))}
        <text x="35" y="214">
          {points.length
            ? new Date(points[0].timestamp).toLocaleDateString()
            : "Awaiting rewards"}
        </text>
        <text x="665" y="214" textAnchor="end">
          {summary.asOf ? new Date(summary.asOf).toLocaleString() : "Now"}
        </text>
      </svg>
    </div>
  );
}

export default function Analytics({
  base,
  probability = null,
  expected = null,
}: {
  base: string;
  probability?: number | null;
  expected?: number | null;
}) {
  const [period, setPeriod] = useState("7d"),
    [ledgerOpen, setLedgerOpen] = useState(false),
    [status, setStatus] = useState(""),
    [worker, setWorker] = useState(""),
    [cursors, setCursors] = useState<string[]>([""]);
  const summary = useLive<Summary>(
    `${base}/api/manager/rewards/summary?period=${period}`,
    30000,
  );
  const ledger = useLive<Ledger>(
    `${base}/api/manager/rewards/ledger?period=${period}&limit=${ledgerOpen ? 50 : 4}&status=${status}&worker=${encodeURIComponent(worker)}&cursor=${cursors.at(-1)}`,
    30000,
  );
  const s = summary.data;
  const components = s
    ? [
        BigInt(s.subsidySompi),
        BigInt(s.acceptedTxFeesSompi),
        BigInt(s.dagMergeRewardSompi),
      ]
    : [0n, 0n, 0n];
  const componentTotal = components.reduce((a, b) => a + b, 0n),
    a = ratio(components[0], componentTotal) * 100,
    b = a + ratio(components[1], componentTotal) * 100;
  const changePeriod = (value: string) => {
    setPeriod(value);
    setCursors([""]);
  };
  return (
    <section className="suite-analytics">
      <div className="suite-toolbar">
        <div>
          <span className="suite-kicker">YOUR MINING PERFORMANCE</span>
          <h2>Every block. Every reward.</h2>
        </div>
        <div className="suite-periods" aria-label="Analytics period">
          {periods.map((p) => (
            <button
              aria-pressed={period === p}
              className={period === p ? "selected" : ""}
              key={p}
              onClick={() => changePeriod(p)}
            >
              {p === "lifetime" ? "Lifetime" : p}
            </button>
          ))}
        </div>
      </div>
      {(summary.error || ledger.error) && (
        <p className="suite-warning" role="status">
          Refresh unavailable: {summary.error || ledger.error}. Displayed data
          may be out of date.
        </p>
      )}
      <div className="suite-stats">
        {[
          [
            "Realised rewards",
            s ? `${kas(s.totalRewardSompi)} KAS` : "—",
            "Verified Blue totals",
          ],
          ["Blocks found", s?.blocksFound ?? "—", "Locally recorded"],
          ["Blue blocks", s?.blueBlocks ?? "—", "Resolved by Rusty Kaspad"],
          [
            "Awaiting resolution",
            s ? s.pendingBlocks + s.errorBlocks : "—",
            "Automatic checks continue",
          ],
        ].map(([title, value, hint]) => (
          <article className="suite-card" key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <div className="suite-analytics-grid">
        <article className="suite-card suite-revenue">
          <div className="suite-card-head">
            <div>
              <span className="suite-kicker">CUMULATIVE REWARDS</span>
              <h3>Realised Kaspa</h3>
            </div>
            <span className="suite-badge">Node resolved</span>
          </div>
          <strong className="suite-total">
            {s ? kas(s.totalRewardSompi) : "—"} <small>KAS</small>
          </strong>
          {s ? <RewardChart summary={s} /> : <p>Loading reward history…</p>}
          <details>
            <summary>Chart data</summary>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Blocks</th>
                    <th>Rewards · KAS</th>
                  </tr>
                </thead>
                <tbody>
                  {s?.daily.map((d) => (
                    <tr key={d.timestamp}>
                      <td>{new Date(d.timestamp).toLocaleString()}</td>
                      <td>{d.blocks}</td>
                      <td>{kas(d.totalRewardSompi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
        <article className="suite-card">
          <span className="suite-kicker">VERIFIED COMPONENTS</span>
          <h3>Reward composition</h3>
          <div
            className="suite-donut"
            role="img"
            aria-label={
              componentTotal > 0n
                ? `Subsidy ${kas(components[0].toString())}, fees ${kas(components[1].toString())}, DAG ${kas(components[2].toString())} KAS`
                : "Verified components unavailable"
            }
            style={{
              background:
                componentTotal > 0n
                  ? `conic-gradient(#70c7ba 0 ${a}%,#55c7e8 ${a}% ${b}%,#a78bfa ${b}% 100%)`
                  : "var(--line)",
            }}
          >
            <div>
              <strong>
                {componentTotal > 0n
                  ? `${Math.round((s?.decompositionCoverage ?? 0) * 100)}%`
                  : "—"}
              </strong>
              <small>coverage</small>
            </div>
          </div>
          <div className="suite-legend">
            {["Block subsidy", "Accepted fees", "DAG merge"].map((v, i) => (
              <div key={v}>
                <i
                  style={{ background: ["#70c7ba", "#55c7e8", "#a78bfa"][i] }}
                />
                <span>{v}</span>
                <b>
                  {componentTotal > 0n ? kas(components[i].toString()) : "—"}
                </b>
              </div>
            ))}
          </div>
          <small>
            Unverified components are excluded. Verified totals remain
            available.
          </small>
        </article>
        <article className="suite-card">
          <span className="suite-kicker">DAG OUTCOMES</span>
          <h3>Block resolution</h3>
          <div className="suite-outcomes">
            {[
              ["Blue", s?.blueBlocks, "#70c7ba"],
              ["Red", s?.redBlocks, "#ef8b91"],
              ["Pending", s?.pendingBlocks, "#e6c46d"],
              ["Retrying", s?.errorBlocks, "#8d9aa9"],
            ].map(([name, count, color]) => (
              <div key={String(name)}>
                <span>{name}</span>
                <div>
                  <i
                    style={{
                      width: `${s?.blocksFound ? (Number(count) / s.blocksFound) * 100 : 0}%`,
                      background: String(color),
                    }}
                  />
                </div>
                <b>{count ?? "—"}</b>
              </div>
            ))}
          </div>
        </article>
        <article className="suite-card">
          <span className="suite-kicker">NEXT 7 DAYS · ESTIMATE</span>
          <h3>Chance of finding a block</h3>
          <div className="suite-probability">
            <svg
              viewBox="0 0 220 130"
              role="img"
              aria-label={
                probability === null
                  ? "Insufficient observations"
                  : `${(probability * 100).toFixed(1)} percent estimated probability`
              }
            >
              <path
                d="M20 110 A90 90 0 0 1 200 110"
                pathLength="100"
                fill="none"
                stroke="var(--line)"
                strokeWidth="15"
              />
              <path
                d="M20 110 A90 90 0 0 1 200 110"
                pathLength="100"
                fill="none"
                stroke="#70c7ba"
                strokeWidth="15"
                strokeDasharray={`${(probability ?? 0) * 100} 100`}
              />
              <text x="110" y="100" textAnchor="middle">
                {probability === null
                  ? "—"
                  : `${(probability * 100).toFixed(1)}%`}
              </text>
            </svg>
            <small>
              {expected === null
                ? "Collecting mining observations"
                : `${expected.toFixed(2)} expected blocks · statistical estimate`}
            </small>
          </div>
        </article>
      </div>
      <article className="suite-card">
        <div className="suite-card-head">
          <div>
            <span className="suite-kicker">BLOCK DISCOVERIES</span>
            <h3>{ledgerOpen ? "Block reward ledger" : "Recent activity"}</h3>
          </div>
          <button
            onClick={() => {
              setLedgerOpen(!ledgerOpen);
              setCursors([""]);
              setStatus("");
              setWorker("");
            }}
          >
            {ledgerOpen ? "Close ledger" : "View full ledger →"}
          </button>
        </div>
        <div className="suite-event-strip" aria-label="Recent block outcomes">
          {ledger.data?.blocks.map((b) => (
            <span
              key={b.hash}
              className={`suite-event ${b.rewardStatus}`}
              title={`${b.worker} · ${label(b.rewardStatus)} · ${new Date(b.timestamp).toLocaleString()}`}
            />
          ))}
        </div>
        {ledgerOpen && (
          <div className="suite-toolbar">
            <label>
              Outcome{" "}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setCursors([""]);
                }}
              >
                <option value="">All outcomes</option>
                {["blue", "red", "pending", "error"].map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Worker{" "}
              <input
                value={worker}
                onChange={(e) => {
                  setWorker(e.target.value);
                  setCursors([""]);
                }}
                placeholder="Filter by worker"
              />
            </label>
          </div>
        )}
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Found</th>
                <th>Worker / block</th>
                <th>Outcome</th>
                <th>Confirmations</th>
                <th>Reward · KAS</th>
              </tr>
            </thead>
            <tbody>
              {ledger.data?.blocks.map((b) => (
                <tr key={b.hash}>
                  <td>{new Date(b.timestamp).toLocaleString()}</td>
                  <td>
                    <strong>{b.worker}</strong>
                    <details>
                      <summary>{b.hash.slice(0, 12)}…</summary>
                      <code className="suite-hash">{b.hash}</code>
                    </details>
                  </td>
                  <td>
                    <span className={`suite-state ${b.rewardStatus}`}>
                      {label(b.rewardStatus)}
                    </span>
                  </td>
                  <td>{b.confirmationCount ?? "—"}</td>
                  <td>
                    {b.rewardStatus === "blue" ? kas(b.totalRewardSompi) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ledger.data?.blocks.length && (
          <p className="suite-empty">
            {ledger.loading
              ? "Loading discoveries…"
              : "No matching blocks in this period."}
          </p>
        )}
        {ledgerOpen && (
          <div className="suite-toolbar">
            <span>{ledger.data?.total ?? 0} matching discoveries</span>
            <div>
              <button
                disabled={cursors.length === 1}
                onClick={() => setCursors((c) => c.slice(0, -1))}
              >
                Previous
              </button>
              <button
                disabled={!ledger.data?.nextCursor}
                onClick={() =>
                  setCursors((c) => [...c, ledger.data!.nextCursor!])
                }
              >
                Next
              </button>
            </div>
          </div>
        )}
      </article>
      {s && (
        <Estimates
          rewardSompi={s.totalRewardSompi}
          periodSeconds={s.periodSeconds}
        />
      )}
      <footer className="suite-toolbar">
        <small>
          {summary.asOf
            ? `Last refreshed ${new Date(summary.asOf).toLocaleTimeString()}`
            : "Connecting to your manager"}
        </small>
        <button
          onClick={() => {
            summary.refresh();
            ledger.refresh();
          }}
        >
          Refresh
        </button>
      </footer>
    </section>
  );
}
