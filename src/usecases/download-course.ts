import type { ILogger } from "../ports/logger";
import type { IHttpClient } from "../ports/http";
import type { IStorage } from "../ports/storage";
import type { OreillyApi } from "../adapters/orly/api";
import type { KalturaService } from "../adapters/kaltura/api";
import type { DownloadItem, AssetInfo } from "../domain/entities";
import { getArrayChunks, sleep, replaceInvalidFileNameCharacters, replaceInvalidDirectoryCharacters, padZeroes } from "../domain/utils";

export interface DownloadCourseInput {
  url: string;
  output: string;
}

export class DownloadCourseUseCase {
  constructor(
    private readonly oreillyApi: OreillyApi,
    private readonly kalturaService: KalturaService,
    private readonly http: IHttpClient,
    private readonly storage: IStorage,
    private readonly logger: ILogger,
  ) {}

  async execute(input: DownloadCourseInput): Promise<void> {
    const originUrl = new URL(input.url).origin;
    const pathname = new URL(input.url).pathname;
    const productId = pathname.split("/").filter(Boolean).pop();

    if (!productId) {
      throw new Error("Could not extract product ID from URL");
    }

    this.logger.info(`Product ID: ${productId}`);
    this.logger.info("Fetching course data...");

    const courseData = await this.oreillyApi.getCourseData(productId, originUrl);
    this.logger.info(`Course: ${courseData.title}`);

    const toc = await this.oreillyApi.getCourseTableOfContents(productId, originUrl);
    this.logger.info(`TOC entries: ${toc.toc.length}`);

    const assetInfos: AssetInfo[] = [];
    const addVideoAsset = (title: string, referenceId: string) => {
      assetInfos.push({
        contentFormat: "VideoClip",
        title: replaceInvalidFileNameCharacters(title),
        referenceId,
      });
    };

    if (toc.toc.length > 0) {
      const first = toc.toc[0]!;
      if (first.ourn) {
        const records = await this.oreillyApi.getEntryRecords(
          productId,
          toc.toc.map((e) => e.reference_id),
          originUrl,
        );
        this.logger.info(`Entry records: ${records.length}`);

        let moduleTitle: string | null = null;
        for (const entry of toc.toc) {
          let parentTitle = entry.title.trim();
          if (entry.depth === 1) {
            moduleTitle = entry.title.trim();
          }

          const record = records.find((r) => r.referenceId === entry.reference_id);
          if (record) {
            const courseTitle = replaceInvalidDirectoryCharacters(courseData.title);
            addVideoAsset(replaceInvalidFileNameCharacters(entry.title.trim()), record.referenceId);

            const idx = assetInfos.length - 1;
            assetInfos[idx] = {
              ...assetInfos[idx]!,
              courseTitle,
              parentTitle:
                moduleTitle && !parentTitle.startsWith("Module ")
                  ? `${moduleTitle}/${parentTitle}`
                  : parentTitle,
              referenceId: entry.reference_id,
              title: entry.title,
            };
          }
        }
      } else {
        for (const entry of toc.toc) {
          const clean = replaceInvalidDirectoryCharacters(entry.title.trim());
          addVideoAsset(clean, entry.reference_id);
        }
      }
    }

    const downloadItems: DownloadItem[] = [];
    for (const info of assetInfos) {
      if (info.contentFormat === "VideoClip") {
        downloadItems.push({
          flavorId: "",
          title: info.title,
          courseTitle: info.courseTitle,
          parentTitle: info.parentTitle,
          fileExt: "mp4",
          fileSize: 0,
        });
      } else if (info.contentFormat === "Part" && info.content) {
        for (const child of info.content) {
          child.parentTitle ||= info.title;
          downloadItems.push({
            flavorId: "",
            title: child.title,
            courseTitle: child.courseTitle,
            parentTitle: child.parentTitle,
            fileExt: "mp4",
            fileSize: 0,
          });
        }
      }
    }

    this.logger.info(`Found ${downloadItems.length} asset(s)`);

    this.kalturaService.setOriginUrl(originUrl);

    const referenceIds = downloadItems.map((d) => d.title).filter(Boolean);

    const entryChunks = getArrayChunks(referenceIds, 500);

    for (let ci = 0; ci < entryChunks.length; ci++) {
      const chunk = entryChunks[ci]!;
      this.logger.progress("Fetching media IDs", ci + 1, entryChunks.length);

      const media = await this.kalturaService.getMediaIds(chunk, 1);
      const entryIds = media.objects.map((o) => o.entryId).filter((id): id is string => Boolean(id));

      const flavorResults = await this.kalturaService.getFlavorIds(entryIds, 1);
      const captionResults = await this.kalturaService.getCaptionIds(entryIds, 1);

      for (const item of downloadItems) {
        const mediaObj = media.objects.find((o) => o.referenceId === item.title);
        if (!mediaObj?.entryId) continue;

        const flavors = (flavorResults.objects ?? []).filter(
          (f) => f.entryId === mediaObj.entryId,
        );
        const bestFlavor = flavors.find((f) => f.videoCodecId) ?? flavors[0];
        if (bestFlavor) {
          item.flavorId = bestFlavor.id;
          item.fileExt = bestFlavor.fileExt;
          item.fileSize = bestFlavor.size;
        }

        if (bestFlavor) {
          const downloadUrl = await this.kalturaService.getVideoDownloadUrl(bestFlavor.id);
          if (typeof downloadUrl === "string") {
            const filename = this.buildFilename(item);
            const fullPath = this.storage.resolve(input.output, filename);
            await this.storage.ensureDir(fullPath);
            const res = await this.http.fetch(downloadUrl);
            const buf = await res.arrayBuffer();
            await this.storage.writeFile(fullPath, new Uint8Array(buf));
            this.logger.info(`Downloaded: ${filename}`);
          }
        }
      }
    }

    this.logger.info("All assets downloaded successfully!");
  }

  private buildFilename(item: DownloadItem): string {
    let name = item.title;
    if (item.index) {
      name = padZeroes(item.index) + name;
    }

    let coursePart = "";
    if (item.courseTitle) {
      const ct = item.courseTitle.trim();
      coursePart = replaceInvalidFileNameCharacters(ct);
    }

    const parentPart =
      item.parentTitle && item.parentTitle !== "undefined"
        ? item.parentTitle.trim()
        : null;

    if (coursePart) {
      const titleClean = name.replaceAll("_", " ");
      name = parentPart
        ? `${coursePart}/${parentPart}/${titleClean}`
        : `${coursePart}/${titleClean}`;
    } else {
      name = name.replaceAll("_", " ");
    }

    name = name.replaceAll(":", " -");
    const ext = item.fileExt ? `.${item.fileExt}` : "";
    return `${name}${ext}`;
  }
}
