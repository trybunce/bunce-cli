import type { Environment } from './config.js';

const BASE_URLS: Record<Environment, string> = {
  live: 'https://api.bunce.so/v1',
  sandbox: 'https://sandbox.api.bunce.so/v1',
};

export interface BunceMeta {
  has_next_page: boolean;
  has_prev_page: boolean;
  next_page_cursor: string | null;
  prev_page_cursor: string | null;
  per_page: number;
}

export interface BunceResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: BunceMeta;
}

export class BunceApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'BunceApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ClientOptions {
  apiKey: string;
  environment: Environment;
  baseUrlOverride?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

export class BunceClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: ClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrlOverride ?? BASE_URLS[opts.environment];
  }

  async request<T>(
    path: string,
    opts: RequestOptions = {},
  ): Promise<BunceResponse<T>> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      'X-Authorization': this.apiKey,
      Accept: 'application/json',
    };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      throw new BunceApiError(
        0,
        `Network error: ${(err as Error).message}`,
        undefined,
      );
    }

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const message =
        (parsed as { message?: string } | undefined)?.message ??
        `Request failed with status ${res.status}`;
      throw new BunceApiError(res.status, message, parsed);
    }

    return parsed as BunceResponse<T>;
  }
}
