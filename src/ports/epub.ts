import type { EpubBookJson, FileListResponse, Manifest, ProgressCallbacks } from "../domain/entities";

export interface IEpubProcessor {
  cacheEbookToDisk(
    book      : EpubBookJson,
    files     : FileListResponse,
    cacheDir  : string,
    callbacks?: ProgressCallbacks,
  ): Promise<Manifest>;

  buildEpubFromCache(
    cacheDir : string,
    manifest : Manifest,
    outputDir: string,
  ): Promise<string>;
}

