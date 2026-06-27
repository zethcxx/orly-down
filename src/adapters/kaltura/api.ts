import type { IHttpClient } from "../../ports/http";
import type {
  KalturaSession,
  KalturaConfig,
  MediaEntry,
  FlavorAsset,
  CaptionAsset,
  MediaEntryFilterBody,
  AssetFilterBody,
  DownloadUrlBody,
} from "../../domain/entities";

const ENDPOINTS = [
  { type: "KalturaMediaEntryFilter"  , url: "https://www.kaltura.com/api_v3/service/media/action/list"                  },
  { type: "KalturaFlavorAssetFilter" , url: "https://www.kaltura.com/api_v3/service/flavorasset/action/list"            },
  { type: "KalturaCaptionAssetFilter", url: "https://www.kaltura.com/api_v3/service/caption_captionasset/action/list"   },
  { type: "VideoDownloadUrl"         , url: "https://www.kaltura.com/api_v3/service/flavorasset/action/getUrl"          },
  { type: "CaptionDownloadUrl"       , url: "https://www.kaltura.com/api_v3/service/caption_captionasset/action/getUrl" },
];

interface ApiState {
  originUrl  : string;
  sessionData: KalturaSession | null;
  partnerId  : number | null;
}

export class KalturaService {
  private state: ApiState = {
    originUrl  : "",
    sessionData: null,
    partnerId  : null,
  };

  constructor(private readonly http: IHttpClient) {}

  setOriginUrl(url: string): void {
    this.state.originUrl = url;
  }

  async getMediaIds(referenceIds: string[], pageSize = 500): Promise<MediaEntry> {
    await this.ensureSession();
    const body = this.buildMediaEntryFilterBody(referenceIds, pageSize);
    const res  = await this.http.fetch(ENDPOINTS[0]!.url, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(body),
    });
    return res.json<MediaEntry>();
  }

  async getFlavorIds(entryIds: string[], pageSize = 500): Promise<{ objects: FlavorAsset[] }> {
    await this.ensureSession();
    const body = this.buildFlavorAssetFilterBody(entryIds, pageSize);
    const res  = await this.http.fetch(ENDPOINTS[1]!.url, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(body),
    });

    return res.json<{ objects: FlavorAsset[] }>();
  }

  async getCaptionIds(entryIds: string[], pageSize = 500): Promise<{ objects: CaptionAsset[] }> {
    await this.ensureSession();
    const body = this.buildCaptionAssetFilterBody(entryIds, pageSize);
    const res  = await this.http.fetch(ENDPOINTS[2]!.url, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(body),
    });
    return res.json<{ objects: CaptionAsset[] }>();
  }

  async getVideoDownloadUrl(flavorId: string): Promise<string | null>
  {
    await this.ensureSession();
    const body = this.buildDownloadUrlBody(flavorId);
    const res  = await this.http.fetch(ENDPOINTS[3]!.url, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(body),
    });

    const text = await res.text();
    if (text === "null" || !text)
      return null;

    const clean = text.replace(/^"|"$/g, "");
    return clean || null;
  }

  async getCaptionDownloadUrl(captionId: string): Promise<string | null>
  {
    await this.ensureSession();
    const body = this.buildDownloadUrlBody(captionId);
    const res  = await this.http.fetch(ENDPOINTS[4]!.url, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(body),
    });

    const text = await res.text();
    if (text === "null" || !text)
      return null;

    const clean = text.replace(/^"|"$/g, "");
    return clean || null;
  }

  private async getSession(): Promise<KalturaSession> {
    const res = await this.http.fetch(`${this.state.originUrl}/api/v1/player/kaltura_session/`);
    if (res.status !== 200) throw new Error("Could not get a valid Kaltura session");
    return res.json<KalturaSession>();
  }

  private async getPartnerId(): Promise<number> {
    const res  = await this.http.fetch(`${this.state.originUrl}/api/v1/player/kaltura_config/`);
    const data = await res.json<KalturaConfig>();
    return data.partner_id;
  }

  private async ensureSession(): Promise<void> {
    const now = new Date();
    if (!this.state.sessionData || now >= new Date(this.state.sessionData.expiry))
      this.state.sessionData = await this.getSession();

    if (!this.state.partnerId)
      this.state.partnerId = await this.getPartnerId();
  }

  private buildMediaEntryFilterBody(referenceIds: string[], pageSize: number): MediaEntryFilterBody {
    return {
      apiVersion: "3.3.0",
      format    : 1,
      ks        : this.state.sessionData?.session,
      clientTag : "kwidget:v3.4.0",
      partnerId : this.state.partnerId,
      p         : this.state.partnerId,
      service   : "media",
      action    : "list",
      filter    : {
        objectType   : "KalturaMediaEntryFilter",
        referenceIdIn: referenceIds.join(","),
        statusIn     : "2",
      },
      pager: { objectType: "KalturaFilterPager", pageSize, pageIndex: 1 },
    };
  }

  private buildFlavorAssetFilterBody(entryIds: string[], pageSize: number): AssetFilterBody {
    return {
      apiVersion: "3.3.0",
      format    : 1,
      ks        : this.state.sessionData?.session,
      clientTag : "kwidget:v3.4.0",
      partnerId : this.state.partnerId,
      service   : "flavorasset",
      action    : "list",
      filter    : {
        objectType: "KalturaFlavorAssetFilter",
        entryIdIn : entryIds.join(","),
        statusIn  : "2",
      },
      pager: { objectType: "KalturaFilterPager", pageSize, pageIndex: 1 },
    };
  }

  private buildCaptionAssetFilterBody(entryIds: string[], pageSize: number): AssetFilterBody {
    return {
      apiVersion: "3.3.0",
      format    : 1,
      ks        : this.state.sessionData?.session,
      clientTag : "kwidget:v3.4.0",
      partnerId : this.state.partnerId,
      service   : "caption_captionasset",
      action    : "list",
      filter    : {
        objectType: "KalturaCaptionAssetFilter",
        entryIdIn : entryIds.join(","),
        statusIn  : "2",
      },
      pager: { objectType: "KalturaFilterPager", pageSize, pageIndex: 1 },
    };
  }

  private buildDownloadUrlBody(id: string): DownloadUrlBody {
    return {
      apiVersion: "3.3.0",
      format    : 1,
      ks        : this.state.sessionData?.session,
      clientTag : "kwidget:v3.4.0",
      partnerId : this.state.partnerId,
      id,
    };
  }
}

