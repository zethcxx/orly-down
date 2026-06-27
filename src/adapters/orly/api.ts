import { ParseError } from "../../domain/errors";

import type { IHttpClient } from "../../ports/http";
import type {
  EpubBookJson,
  EpubFileItem,
  FileListResponse,
  TableOfContents,
  User,
  EntryRecord,
} from "../../domain/entities";

interface StoreData {
  appState?: {
    tableOfContents?: Record<string, string>;
  };
}

export class OreillyApi {
  constructor(private readonly http: IHttpClient) {}

  async getBookJson(originUrl: string, toc: Record<string, string>): Promise<EpubBookJson> {
    const keys = Object.keys(toc);
    if (keys.length === 0) {
      throw new ParseError("tableOfContents is empty");
    }

    const base = `${originUrl}/api/v2/epubs/`;
    let key = keys[0]!;
    let res = await this.http.fetch(`${base}${key}/`);
    if (res.status === 404) {
      key = key.replace("book", "article");
      res = await this.http.fetch(`${base}${key}/`);
    }
    if (!res.ok) {
      throw new ParseError(`eBook API returned ${res.status} for key ${key}`);
    }

    return res.json<EpubBookJson>();
  }

  async getFileList(book: EpubBookJson): Promise<FileListResponse> {
    // Probe with limit=1 to get total count
    const probeUrl = book.files + "?limit=1";
    const probeRes = await this.http.fetch(probeUrl);
    const probeData = await probeRes.json<{ count: number }>();
    const count = probeData.count;

    if (count < 10000) {
      const res = await this.http.fetch(book.files + "?limit=" + count);
      return res.json<FileListResponse>();
    }

    // Large result: paginate in chunks of 10000
    const allResults: EpubFileItem[] = [];
    let nextUrl: string | null = book.files + "?limit=10000";

    while (nextUrl) {
      const res = await this.http.fetch(nextUrl);
      const data = await res.json<FileListResponse>();
      allResults.push(...data.results);
      nextUrl = data.next ?? null;
    }

    return { count, results: allResults };
  }

  async fetchTableOfContents(url: string): Promise<Record<string, string> | null>
  {
    try {
      const res  = await this.http.fetch(url);
      const html = await res.text();
      const data = extractBalancedJson(html, "initialStoreData = ");
      if (!data?.appState?.tableOfContents) return null;

      const toc: Record<string, string> = {};
      for (const [key, val] of Object.entries(data.appState.tableOfContents)) {
        toc[key] = String(val);
      }

      return Object.keys(toc).length > 0 ? toc : null;
    } catch {
      return null;
    }
  }

  async getUserStatus(originUrl: string): Promise<{ reason: string; canProceed: boolean }>
  {
    const res = await this.http.fetch(`${originUrl}/api/v1/me/`);
    const data = await res.json<User>();

    const reason: string[] = [];
    if (data.expired_trial)
      reason.push("trial expired");

    if (
      data.subscription &&
      !data.subscription.active &&
      !data.subscription.cancellation_date
    ) {
      reason.push("subscription not active");
    }

    return {
      reason: reason.join(", "),
      canProceed: reason.length === 0,
    };
  }

  async getUser(originUrl: string): Promise<User> {
    const res = await this.http.fetch(`${originUrl}/api/v1/me/`);
    return res.json<User>();
  }

  async getCourseData(productId: string, originUrl: string): Promise<{ title: string }> {
    const res = await this.http.fetch(
      `${originUrl}/api/v1/course/${productId}/`,
    );
    return res.json<{ title: string }>();
  }

  async getCourseTableOfContents(productId: string, originUrl: string): Promise<TableOfContents> {
    const res = await this.http.fetch(
      `${originUrl}/api/v1/course/${productId}/table_of_contents/`,
    );
    return res.json<TableOfContents>();
  }

  async getEntryRecords(
    productId   : string,
    referenceIds: string[],
    originUrl   : string,
  ): Promise<EntryRecord[]> {
    const url = `${originUrl}/api/v1/course/${productId}/entry_records/`;
    const allRecords: EntryRecord[] = [];
    const { getArrayChunks, sleep } = await import("../../domain/utils");

    const chunks = getArrayChunks(referenceIds, 500);
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk  = chunks[ci]!;
      const params = new URLSearchParams();

      chunk.forEach((ref) => params.append("reference_id", ref));

      const res  = await this.http.fetch(`${url}?${params.toString()}`);
      const data = await res.json<{ objects: EntryRecord[] }>();

      if (data.objects)
        allRecords.push(...data.objects);

      if (ci < chunks.length - 1)
        await sleep(1000);
    }

    return allRecords;
  }
}

function extractBalancedJson(html: string, marker: string): StoreData | null
{
  const startIdx = html.indexOf(marker);
  if (startIdx === -1)
    return null;

  const jsonStart = html.indexOf("{", startIdx + marker.length);
  if (jsonStart === -1)
    return null;

  let depth    = 0;
  let inString = false;
  let escaped  = false;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const raw = html.substring(jsonStart, i + 1);
          return JSON.parse(raw) as StoreData;
        }
      }
    }
  }

  return null;
}

