/**
 * Field-coverage analysis — the actual Phase 0 decision artifact.
 *
 * For each expected field it reports how often the account actually populates it
 * over the pulled window. A field that is 0% populated means the coach can't rely
 * on it; that's exactly what we need to learn in an afternoon, not in week six.
 */

export interface FieldCoverage {
  field: string;
  present: number;
  total: number;
  coveragePct: number;
  sample: unknown; // first non-null/undefined value seen, for eyeballing units
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return obj[path];
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function isPresent(v: unknown): boolean {
  return v !== null && v !== undefined && !(typeof v === "number" && Number.isNaN(v));
}

/** Compute per-field coverage across a set of records. */
export function fieldCoverage(
  records: ReadonlyArray<Record<string, unknown>>,
  fields: readonly string[],
): FieldCoverage[] {
  const total = records.length;
  return fields.map((field) => {
    let present = 0;
    let sample: unknown = undefined;
    for (const rec of records) {
      const v = getPath(rec, field);
      if (isPresent(v)) {
        present += 1;
        if (sample === undefined) sample = v;
      }
    }
    return {
      field,
      present,
      total,
      coveragePct: total === 0 ? 0 : Math.round((present / total) * 1000) / 10,
      sample,
    };
  });
}

/** Render a coverage table as a fixed-width string for terminal output. */
export function formatCoverage(title: string, rows: FieldCoverage[]): string {
  const head = `\n${title} (${rows[0]?.total ?? 0} records)`;
  const line = "-".repeat(head.trim().length);
  const body = rows
    .map((r) => {
      const flag = r.coveragePct === 0 ? "  ✗" : r.coveragePct < 50 ? "  ~" : "  ✓";
      const name = r.field.padEnd(22);
      const pct = `${r.coveragePct}%`.padStart(6);
      const cnt = `${r.present}/${r.total}`.padStart(8);
      const sample =
        r.sample === undefined ? "" : `  e.g. ${JSON.stringify(r.sample)}`.slice(0, 40);
      return `${flag} ${name}${pct}${cnt}${sample}`;
    })
    .join("\n");
  return `${head}\n${line}\n${body}`;
}
