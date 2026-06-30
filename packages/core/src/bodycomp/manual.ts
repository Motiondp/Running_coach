/**
 * Manual scan entry — the PRIMARY body-composition path.
 *
 * The athlete reads the full panel off a gym Technogym/Tanita bioimpedance scale
 * (printout / app screen) and types it in. There is no clean Technogym export, so
 * this — not the ZIP parser — is how scans normally get in. Each field carries its
 * own already-local calendar date (the scale's weight and full-composition readings
 * can be from different days), so NO timezone conversion happens here: the user types
 * local dates directly. The result is the same `ParsedBodyComp` shape the ZIP parser
 * produces, so all downstream insight code is identical regardless of source.
 */
import type { IsoDate } from "../dates/localDate.js";
import { defaultUnit } from "../technogym/metrics.js";
import type { BodyCompMetric, DatedMetric, ParsedBodyComp } from "../technogym/types.js";

export interface ManualScanEntry {
  metric: BodyCompMetric;
  value: number;
  /** Local calendar date the athlete attributes to this reading (defaults to today upstream). */
  date: IsoDate;
  unit?: string;
}

export function bodyCompFromManualEntry(entries: ManualScanEntry[]): ParsedBodyComp {
  const history: DatedMetric[] = entries
    .filter((e) => Number.isFinite(e.value) && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => ({
      metric: e.metric,
      value: e.value,
      unit: e.unit && e.unit.length > 0 ? e.unit : defaultUnit(e.metric),
      date: e.date,
    }));

  history.sort((a, b) => b.date.localeCompare(a.date));

  const metrics: ParsedBodyComp["metrics"] = {};
  for (const dm of history) {
    if (!metrics[dm.metric]) metrics[dm.metric] = dm;
  }

  return { metrics, history, unmapped: [] };
}
