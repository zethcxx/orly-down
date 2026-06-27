export interface HttpHeaders {
  [key: string]: string;
}

export interface HttpRequestInit {
  method ?: string;
  headers?: HttpHeaders;
  body   ?: BodyInit | null;
}

export interface HttpResponse {
  readonly status : number;
  readonly ok     : boolean;
  readonly url    : string;
  readonly headers: HttpHeaders;

  text(): Promise<string>;
  json<T>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface RetryConfig {
  maxRetries : number;
  baseDelayMs: number;
  maxDelayMs : number;
}

export interface IHttpClient {
  fetch(url: string, init?: HttpRequestInit): Promise<HttpResponse>;
  setCookie(cookie: string): void;
  getCookie(): string | null;
  loadCookieFile(filePath: string): Promise<void>;
  loadCookieJson(source: string): Promise<void>;
}

