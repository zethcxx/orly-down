import { parseArgs             } from "./args"                     ;
import { detectContentType     } from "./detect"                   ;
import { ConsoleLogger         } from "../adapters/logger/console" ;
import type { ILogger          } from "../ports/logger"            ;
import { HttpClient            } from "../adapters/http/client"    ;
import { DiskStorage           } from "../adapters/storage/disk"   ;
import { OreillyApi            } from "../adapters/orly/api"       ;
import { KalturaService        } from "../adapters/kaltura/api"    ;
import { EpubProcessor         } from "../adapters/epub/processor" ;
import { EpubBuilder           } from "../adapters/epub/builder"   ;
import { DownloadEbookUseCase  } from "../usecases/download-ebook" ;
import { DownloadCourseUseCase } from "../usecases/download-course";

async function downloadEbook(
  url: string,
  output: string,
  byPassWatermark: boolean,
  httpClient: HttpClient,
  storage: DiskStorage,
  logger: ILogger,
): Promise<void> {
  const oreillyApi    = new OreillyApi(httpClient);
  const epubProcessor = new EpubProcessor(httpClient, storage);
  const epubBuilder   = new EpubBuilder(storage);
  const useCase       = new DownloadEbookUseCase(oreillyApi, epubProcessor, epubBuilder, storage, logger);
  await useCase.execute({ url, output, byPassWatermark });
}

async function downloadCourse(
  url: string,
  output: string,
  httpClient: HttpClient,
  storage: DiskStorage,
  logger: ILogger,
): Promise<void> {
  const oreillyApi     = new OreillyApi(httpClient);
  const kalturaService = new KalturaService(httpClient);
  const useCase        = new DownloadCourseUseCase(oreillyApi, kalturaService, httpClient, storage, logger);
  await useCase.execute({ url, output });
}

async function main(): Promise<void>
{
  const options = parseArgs();
  const logger = new ConsoleLogger();

  console.log("")
  console.log("█▀█ █▀█ █   █▄█   █▀▄ █▀█ █ █ █ █▄ █ █   █▀█ ▄▀█ █▀▄ █▀▀ █▀█");
  console.log("█▄█ █▀▄ █▄▄  █    █▄▀ █▄█ ▀▄▀▄▀ █ ▀█ █▄▄ █▄█ █▀█ █▄▀ ██▄ █▀▄");
  console.log("")

  const httpClient = new HttpClient(
    {
      maxRetries : options.maxRetries,
      baseDelayMs: options.baseDelay
    },
  );

  if (options.cookieFile) {
    await httpClient.loadCookieFile(options.cookieFile);
    logger.info(`Cookie file: ${options.cookieFile}`);

  } else if (options.cookieJson) {
    await httpClient.loadCookieJson(options.cookieJson);
    logger.info(`Cookie JSON: ${options.cookieJson}`);

  } else if (options.cookie) {
    httpClient.setCookie(options.cookie);
    logger.info("Cookie: inline");
  }

  const storage = new DiskStorage();

  if (options.maxRetries > 0) {
    logger.info(`Retry:  max ${options.maxRetries}, base delay ${options.baseDelay}ms`);
  }

  const tasks: (() => Promise<void>)[] = [];

  for (const url of options.urls) {
    const detectedType = options.type === "auto" ? detectContentType(url) : options.type;

    switch (detectedType) {
      case "course":
        tasks.push(() => downloadCourse(url, options.output, httpClient, storage, logger));
        break;
      case "ebook":
        tasks.push(() => downloadEbook(url, options.output, options.byPassWatermark, httpClient, storage, logger));
        break;
    }
  }

  if (options.parallel) {
    await Promise.all(tasks.map((t) => t()));
  } else {
    for (const task of tasks) {
      await task();
    }
  }

  console.log("\n  [x] Done!\n");
}

main().catch((err) => {
  console.error("  [x] Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

