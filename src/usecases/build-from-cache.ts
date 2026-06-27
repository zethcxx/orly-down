import type { ILogger } from "../ports/logger";
import type { IStorage } from "../ports/storage";
import type { EpubBuilder } from "../adapters/epub/builder";
import type { Manifest } from "../domain/entities";

export interface BuildFromCacheInput {
  cacheDir: string;
  outputDir: string;
}

export class BuildFromCacheUseCase {
  constructor(
    private readonly epubBuilder: EpubBuilder,
    private readonly storage: IStorage,
    private readonly logger: ILogger,
  ) {}

  async execute(input: BuildFromCacheInput): Promise<string> {
    const manifestPath = this.storage.resolve(input.cacheDir, "manifest.json");

    if (!this.storage.exists(manifestPath)) {
      throw new Error(`No manifest.json found in ${input.cacheDir}`);
    }

    const manifestRaw = await this.storage.readTextFile(manifestPath);
    const manifest: Manifest = JSON.parse(manifestRaw) as Manifest;

    this.logger.info(`Rebuilding "${manifest.title}" from cache...`);
    this.logger.info(`Files: ${manifest.files.length}`);

    const epubPath = await this.epubBuilder.buildFromCache(input.cacheDir, manifest, input.outputDir);

    this.logger.info(`ePub created: ${epubPath}`);
    return epubPath;
  }
}
