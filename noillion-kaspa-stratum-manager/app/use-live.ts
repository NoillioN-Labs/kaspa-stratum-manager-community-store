"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export async function readApi<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export function useLive<T>(url: string, interval = 5000, enabled = true) {
  const [result, setResult] = useState<{
    url: string;
    data: T;
    at: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const generation = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const id = ++generation.current,
      controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      setLoading(true);
      try {
        const data = await readApi<T>(url, controller.signal);
        if (id === generation.current && !controller.signal.aborted) {
          setResult({ url, data, at: Date.now() });
          setError("");
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "Connection unavailable",
          );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(
            poll,
            document.hidden ? Math.max(interval, 30000) : interval,
          );
        }
      }
    };
    timer = setTimeout(poll, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [url, interval, enabled, revision]);
  return {
    data: result?.url === url ? result.data : null,
    asOf: result?.url === url ? result.at : null,
    error,
    loading,
    refresh,
  };
}
