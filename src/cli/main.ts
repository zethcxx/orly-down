import { parseArgs             } from "./args"                     ;
import { detectContentType     } from "./detect"                   ;
import { ConsoleLogger         } from "../adapters/logger/console" ;
import { HttpClient            } from "../adapters/http/client"    ;
import { DiskStorage           } from "../adapters/storage/disk"   ;
import { OreillyApi            } from "../adapters/orly/api"       ;
import { KalturaService        } from "../adapters/kaltura/api"    ;
import { EpubProcessor         } from "../adapters/epub/processor" ;
import { EpubBuilder           } from "../adapters/epub/builder"   ;
import { DownloadEbookUseCase  } from "../usecases/download-ebook" ;
import { DownloadCourseUseCase } from "../usecases/download-course";

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

  const detectedType = options.type === "auto" ? detectContentType(options.url) : options.type;
  logger.info(`URL   : ${options.url}`);
  logger.info(`Type  : ${detectedType}`);
  logger.info(`Output: ${options.output}`);

  if (options.maxRetries > 0) {
    logger.info(`Retry:  max ${options.maxRetries}, base delay ${options.baseDelay}ms`);
  }

  switch (detectedType) {
    case "course": {
      const oreillyApi     = new OreillyApi(httpClient);
      const kalturaService = new KalturaService(httpClient);
      const useCase        = new DownloadCourseUseCase(oreillyApi, kalturaService, httpClient, storage, logger);
      await useCase.execute({ url: options.url, output: options.output });
      break;
    }
    case "ebook": {
      const oreillyApi    = new OreillyApi(httpClient);
      const epubProcessor = new EpubProcessor(httpClient, storage);
      const epubBuilder   = new EpubBuilder(storage);
      const useCase       = new DownloadEbookUseCase(oreillyApi, epubProcessor, epubBuilder, storage, logger);
      await useCase.execute({
        url            : options.url,
        output         : options.output,
        byPassWatermark: options.byPassWatermark,
      });
      break;
    }
  }

  console.log("\n  [x] Done!\n");
}

main().catch((err) => {
  console.error("  [x] Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

