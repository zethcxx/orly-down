import type { ILogger       } from "../ports/logger";
import type { OreillyApi    } from "../adapters/orly/api";
import type { EpubProcessor } from "../adapters/epub/processor";
import type { EpubBuilder   } from "../adapters/epub/builder";
import type { IStorage      } from "../ports/storage";

import { replaceInvalidDirectoryCharacters } from "../domain/utils";

export interface DownloadEbookInput {
  url              : string;
  output           : string;
  byPassWatermark ?: boolean;
}

export class DownloadEbookUseCase {
  constructor(
    private readonly oreillyApi   : OreillyApi,
    private readonly epubProcessor: EpubProcessor,
    private readonly epubBuilder  : EpubBuilder,
    private readonly storage      : IStorage,
    private readonly logger       : ILogger,
  ) {}

  async execute(input: DownloadEbookInput): Promise<{ cacheDir: string; epubPath: string }> {
    const originUrl = new URL(input.url).origin;

    this.logger.info("Fetching ebook metadata...");

    const toc = await this.oreillyApi.fetchTableOfContents(input.url);
    if (!toc || Object.keys(toc).length === 0) {
      throw new Error("Could not find tableOfContents. Check cookies.");
    }

    const book = await this.oreillyApi.getBookJson(originUrl, toc);
    const fileList = await this.oreillyApi.getFileList(book);

    this.logger.info(`Title: ${book.title}`);
    this.logger.info(`Files: ${fileList.count}`);

    const safeTitle = replaceInvalidDirectoryCharacters(book.title);
    const cacheDirName = `${safeTitle}-${book.identifier}`;
    const cacheDir = this.storage.resolve(input.output, ".cache", cacheDirName);

    this.logger.info(`Caching files to: ${cacheDir}`);

    const manifest = await this.epubProcessor.cacheEbookToDisk(book, fileList, cacheDir, {
      byPass: input.byPassWatermark,
      cbBatchProgress: (info) => this.logger.batch(info),
    });

    this.logger.info(`Cached ${manifest.files.length} files to ${cacheDir}`);

    const epubPath = await this.epubBuilder.buildFromCache(cacheDir, manifest, input.output);
    this.logger.info(`ePub created: ${epubPath}`);

    return { cacheDir, epubPath };
  }
}

