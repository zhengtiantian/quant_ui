/** The held and watched stocks' volume figures (quant_ai /portfolio/volume, 2026-11-21): fetched once for the
 *  Holdings page and shared by the Volume column of both tables. The server works them out once per
 *  completed US session; while it does ("refreshing") the page asks again shortly. */
import React from "react";
import { fetchVolume } from "../../api/markets";
import type { VolumeState } from "../../api/markets";

const RETRY_MS = 20_000;
const POLL_MS = 30 * 60_000;

export function useVolume(): VolumeState | null {
  const [st, setSt] = React.useState<VolumeState | null>(null);
  React.useEffect(() => {
    let timer = 0;
    let alive = true;
    const load = () => {
      fetchVolume()
        .then((r) => {
          if (!alive) return;
          setSt(r);
          timer = window.setTimeout(load, r.refreshing ? RETRY_MS : POLL_MS);
        })
        .catch(() => { if (alive) timer = window.setTimeout(load, POLL_MS); });
    };
    load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, []);
  return st;
}
