import { zip, strToU8 } from "fflate";
import type { AsyncZippable } from "fflate";
import type { IStorage } from "../../ports/storage";
import type { Manifest, ManifestFile } from "../../domain/entities";
import { replaceInvalidFileNameCharacters } from "../../domain/utils";

const MIMETYPE_CONTENT = "application/epub+zip";

function findPackageFile(files: ManifestFile[]): ManifestFile | undefined {
  return files.find(
    (f) => f.media_type === "application/oebps-package+xml" || f.full_path.endsWith(".opf"),
  );
}

function makeContainerXml(packagePath: string): Uint8Array {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="${packagePath}" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  return strToU8(xml);
}

export class EpubBuilder {
  constructor(private readonly storage: IStorage) {}

  async buildFromCache(cacheDir: string, manifest: Manifest, outputDir: string): Promise<string> {
    const epubFilename = replaceInvalidFileNameCharacters(`${manifest.title}-${manifest.identifier}.epub`);
    const epubPath = this.storage.resolve(outputDir, epubFilename);
    const zipData: AsyncZippable = {};

    const packageFile = findPackageFile(manifest.files);
    const packagePath = packageFile?.full_path ?? "OEBPS/package.opf";

    // mimetype must be the first entry, stored uncompressed (EPUB spec)
    zipData["mimetype"] = [strToU8(MIMETYPE_CONTENT), { level: 0 }];

    // META-INF/container.xml is required
    zipData["META-INF/container.xml"] = [makeContainerXml(packagePath), { level: 9 }];

    // All other files from manifest
    for (const file of manifest.files) {
      if (file.full_path === "mimetype" || file.full_path === "META-INF/container.xml") {
        continue;
      }

      const diskPath = this.storage.resolve(cacheDir, file.full_path);
      const data = await this.storage.readFile(diskPath);
      const level = file.kind === "image" ? 0 : 9;
      zipData[file.full_path] = [new Uint8Array(data), { level: level as 0 | 9 }];
    }

    const zipped = await new Promise<Uint8Array>((resolve, reject) => {
      zip(zipData, { level: 0 }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    await this.storage.ensureDir(epubPath);
    await this.storage.writeFile(epubPath, zipped);
    return epubPath;
  }
}
