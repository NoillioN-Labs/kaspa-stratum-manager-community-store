"use client";
import { useEffect, useState } from "react";
export default function Estimates({
  rewardSompi,
  periodSeconds,
}: {
  rewardSompi: string;
  periodSeconds: number;
}) {
  const [price, setPrice] = useState(""),
    [watts, setWatts] = useState(""),
    [tariff, setTariff] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("ksm-cost-estimates") ?? "{}",
        );
        setPrice(saved.price ?? "");
        setWatts(saved.watts ?? "");
        setTariff(saved.tariff ?? "");
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const save = (values: { price: string; watts: string; tariff: string }) => {
    try {
      localStorage.setItem("ksm-cost-estimates", JSON.stringify(values));
    } catch {}
  };
  const valid = [price, watts, tariff].every(
    (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0,
  );
  const income =
      Number(BigInt(rewardSompi) / 100000000n) * Number(price) +
      (Number(BigInt(rewardSompi) % 100000000n) / 1e8) * Number(price),
    cost = (((Number(watts) / 1000) * periodSeconds) / 3600) * Number(tariff);
  return (
    <details className="suite-card">
      <summary>Electricity and value estimates</summary>
      <p>
        Enter your own price and tariff in the same currency. Values stay in
        this browser. Estimates are separate from exact Kaspa rewards.
      </p>
      <div className="suite-toolbar">
        {[
          [
            "Price per KAS",
            price,
            (v: string) => {
              setPrice(v);
              save({ price: v, watts, tariff });
            },
          ],
          [
            "Fleet power · watts",
            watts,
            (v: string) => {
              setWatts(v);
              save({ price, watts: v, tariff });
            },
          ],
          [
            "Electricity per kWh",
            tariff,
            (v: string) => {
              setTariff(v);
              save({ price, watts, tariff: v });
            },
          ],
        ].map(([label, value, set]) => (
          <label key={String(label)}>
            {String(label)}
            <input
              type="number"
              min="0"
              step="any"
              value={String(value)}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
            />
          </label>
        ))}
      </div>
      <p>
        {valid
          ? `Estimated value ${income.toFixed(2)} · electricity ${cost.toFixed(2)} · after electricity ${(income - cost).toFixed(2)} for this period.`
          : "Enter all three values to calculate."}
      </p>
    </details>
  );
}

