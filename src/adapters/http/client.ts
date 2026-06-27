import { existsSync, readFileSync        } from "node:fs"            ;
import { HttpError , RetryExhaustedError } from "../../domain/errors";

import type {
  IHttpClient,
  HttpHeaders,
  HttpRequestInit,
  HttpResponse,
  RetryConfig
} from "../../ports/http";

const DEFAULT_BROWSER_HEADERS: HttpHeaders = {
  "User-Agent"     : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept"         : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",

  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",

  "Upgrade-Insecure-Requests": "1",
  DNT: "1",

  Connection: "keep-alive",
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries : 3,
  baseDelayMs: 1000,
  maxDelayMs : 10000,
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

class FetchResponse implements HttpResponse {
  readonly status : number     ;
  readonly ok     : boolean    ;
  readonly headers: HttpHeaders;

  constructor(private readonly inner: Response) {
    this.status = inner.status;
    this.ok     = inner.ok;

    const hdrs: HttpHeaders = {};
    inner.headers.forEach((val, key) => { hdrs[key] = val; });
    this.headers = hdrs;
  }

  get url(): string {
    return this.inner.url;
  }

  text(): Promise<string> {
    return this.inner.text();
  }

  async json<T>(): Promise<T> {
    return this.inner.json() as Promise<T>;
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return this.inner.arrayBuffer();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function calculateBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay  = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
  const jitter = delay * 0.3 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

export class HttpClient implements IHttpClient {
  private cookieHeader: string | null = null;

  private readonly browserHeaders: HttpHeaders;
  private readonly retryConfig   : RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>, browserHeaders?: HttpHeaders) {
    this.retryConfig    = { ...DEFAULT_RETRY_CONFIG   , ...retryConfig    };
    this.browserHeaders = { ...DEFAULT_BROWSER_HEADERS, ...browserHeaders };
  }

  setCookie(cookie: string): void {
    this.cookieHeader = cookie;
  }

  getCookie(): string | null {
    return this.cookieHeader;
  }

  async loadCookieFile(filePath: string): Promise<void>
  {
    const text  = readFileSync(filePath, "utf-8");
    const lines = text.split("\n");
    const pairs: string[] = [];

    for (const line of lines) {
      const pair = parseNetscapeLine(line);

      if (pair)
        pairs.push(pair);
    }

    if (pairs.length === 0) {
      const trimmed = text.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        return this.loadCookieJson(text);
      }
      pairs.push(trimmed);
    }

    this.cookieHeader = pairs.join("; ");
  }

  async loadCookieJson(source: string): Promise<void>
  {
    let raw: string;

    if (existsSync(source))
      raw = readFileSync(source, "utf-8");
    else
      raw = source;


    const parsed = JSON.parse(raw);
    const pairs: string[] = [];

    if (Array.isArray(parsed)) {
      for (const c of parsed) {
        if (c.name && c.value) {
          pairs.push(`${encodeURIComponent(c.name)}=${encodeURIComponent(c.value)}`);
        }
      }
    } else if (parsed && typeof parsed === "object") {
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === "string") {
          pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
        }
      }
    }

    this.cookieHeader = pairs.join("; ");
  }

  async fetch(url: string, init?: HttpRequestInit): Promise<HttpResponse> {
    return this.fetchWithRetry(url, init, 0);
  }

  private async fetchWithRetry(
    url     : string,
    init   ?: HttpRequestInit,
    attempt : number = 0,
  ): Promise<HttpResponse> {
    try {
      const response = await this.executeFetch(url, init);

      if (!response.ok && RETRYABLE_STATUSES.has(response.status) && attempt < this.retryConfig.maxRetries) {
        const delay = calculateBackoff(attempt, this.retryConfig.baseDelayMs, this.retryConfig.maxDelayMs);
        await sleep(delay);
        return this.fetchWithRetry(url, init, attempt + 1);
      }

      return response;
    } catch (err) {
      if (attempt < this.retryConfig.maxRetries) {
        const delay = calculateBackoff(attempt, this.retryConfig.baseDelayMs, this.retryConfig.maxDelayMs);
        await sleep(delay);
        return this.fetchWithRetry(url, init, attempt + 1);
      }

      const lastError = err instanceof Error ? err : new Error(String(err));
      throw new RetryExhaustedError(url, attempt + 1, lastError);
    }
  }

  private async executeFetch(url: string, init?: HttpRequestInit): Promise<FetchResponse> {
    const headers = new Headers();

    for (const [key, val] of Object.entries(this.browserHeaders)) {
      headers.set(key, val);
    }

    if (init?.headers) {
      for (const [key, val] of Object.entries(init.headers)) {
        headers.set(key, val);
      }
    }

    if (this.cookieHeader && !headers.has("Cookie")) {
      headers.set("Cookie", this.cookieHeader);
    }

    const origin = new URL(url).origin;
    if (!headers.has("Referer") && !headers.has("referer")) {
      headers.set("Referer", origin + "/");
    }
    if (!headers.has("Origin")) {
      headers.set("Origin", origin);
    }

    const fetchInit: RequestInit = { ...init, headers } as RequestInit;

    const raw = await fetch(url, fetchInit);
    return new FetchResponse(raw);
  }
}

function parseNetscapeLine(line: string): string | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#"))
    return null;

  const parts = trimmed.split("\t");
  if (parts.length < 7)
    return null;

  const [, , , , , name, value] = parts;
  return `${encodeURIComponent(name ?? "")}=${encodeURIComponent(value ?? "")}`;
}

