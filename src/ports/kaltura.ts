import type { MediaEntry, FlavorAsset, CaptionAsset } from "../domain/entities";

export interface IKalturaService {
  setOriginUrl(url: string): void;
  getMediaIds (referenceIds: string[], pageSize?: number): Promise<MediaEntry>;

  getFlavorIds (entryIds: string[], pageSize?: number): Promise<{ objects: FlavorAsset[]  }>;
  getCaptionIds(entryIds: string[], pageSize?: number): Promise<{ objects: CaptionAsset[] }>;

  getVideoDownloadUrl  (flavorId : string): Promise<string | null>;
  getCaptionDownloadUrl(captionId: string): Promise<string | null>;
}

