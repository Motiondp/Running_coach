/**
 * Minimal intervals.icu API client.
 *
 * Auth is HTTP Basic with username `API_KEY` and the personal key as the password
 * (Settings → Developer). Uses global fetch (Node 18+/RN/Deno all provide it), so
 * this stays dependency-free and runs in every environment that imports core.
 */
import type { IntervalsActivity, IntervalsAthlete, IntervalsWellness } from "./types.js";

const DEFAULT_BASE_URL = "https://intervals.icu/api/v1";

export interface IntervalsClientOptions {
  apiKey: string;
  /** Athlete id, e.g. "i12345". Defaults to "0" which resolves to the key's owner. */
  athleteId?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class IntervalsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "IntervalsError";
  }
}

export class IntervalsClient {
  private readonly apiKey: string;
  private readonly athleteId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: IntervalsClientOptions) {
    if (!opts.apiKey) throw new Error("IntervalsClient: apiKey is required");
    this.apiKey = opts.apiKey;
    this.athleteId = opts.athleteId && opts.athleteId.length > 0 ? opts.athleteId : "0";
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private authHeader(): string {
    // btoa is global in Node 18+, browsers, RN and Deno.
    return "Basic " + btoa(`API_KEY:${this.apiKey}`);
  }

  private async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    const res = await this.fetchImpl(url.toString(), {
      headers: { Authorization: this.authHeader(), Accept: "application/json" },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new IntervalsError(
        `intervals.icu ${res.status} on ${path}`,
        res.status,
        text.slice(0, 500),
      );
    }
    return JSON.parse(text) as T;
  }

  /** GET /athlete/{id} — profile (also confirms auth works). */
  getAthlete(): Promise<IntervalsAthlete> {
    return this.get<IntervalsAthlete>(`/athlete/${this.athleteId}`);
  }

  /** GET /athlete/{id}/activities — between two YYYY-MM-DD dates (inclusive). */
  getActivities(oldest: string, newest: string): Promise<IntervalsActivity[]> {
    return this.get<IntervalsActivity[]>(`/athlete/${this.athleteId}/activities`, {
      oldest,
      newest,
    });
  }

  /** GET /athlete/{id}/wellness — daily records between two YYYY-MM-DD dates. */
  getWellness(oldest: string, newest: string): Promise<IntervalsWellness[]> {
    return this.get<IntervalsWellness[]>(`/athlete/${this.athleteId}/wellness`, {
      oldest,
      newest,
    });
  }
}
