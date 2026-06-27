import type { IHttpClient } from "../../ports/http";
import type { IStorage } from "../../ports/storage";
import type {
  EpubBookJson,
  EpubFileItem,
  FileListResponse,
  Manifest,
  ManifestFile,
  ProgressCallbacks,
  SpineInfo,
  User,
} from "../../domain/entities";
import { getArrayChunks, sleep, replaceInvalidFileNameCharacters, replaceInvalidDirectoryCharacters } from "../../domain/utils";

const strToU8 = (str: string): Uint8Array => new TextEncoder().encode(str);

const VOID_ELEMENTS = ["img", "br", "hr", "col"];

const stripScriptsAndLinks = (html: string): string => {
  const re = /<script.*><\/script>|<link.*[/]>|<link.*>/gim;
  return html.replaceAll(re, "");
};

const htmlEncode = (str: string): string => str.replaceAll("&", "&amp;");

const wrapHtml = (
  book: EpubBookJson,
  relDepth: string,
  styleTags: string[],
  content: string,
): string => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xml:lang="${book.language}" lang="${book.language}" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${htmlEncode(book.title)}</title>${styleTags.join("")}</head><body><div id="book-content">${content}</div></body></html>`;

const processChapter = (
  book: EpubBookJson,
  file: EpubFileItem,
  spine: SpineInfo,
  text: string,
): string => {
  let processed = text;

  // Step 1: Remove O'Reilly API base URLs from file paths
  processed = processed.replaceAll(`/api/v2/epubs/${book.ourn}/files/`, "");

  // Step 2: Strip script and link tags (original behavior)
  processed = stripScriptsAndLinks(processed);

  // Step 3: Calculate relative depth from file path
  const relDepth = Array.from(file.full_path).reduce((acc, ch) => ch === "/" ? acc + "../" : acc, "");

  // Step 4: Self-close void elements and fix image src paths
  const voidRe = new RegExp(`(?:<(?:${VOID_ELEMENTS.join("|")})(?!group)(?:[^>]?|[^>]+))(?<!/)>`, "gim");
  for (const match of [...processed.matchAll(voidRe)]) {
    const el = match[0]!;
    const selfClosed = el.replace(">", "/>");
    processed = processed.replace(el, selfClosed.replace('src="', `src="${relDepth}`));
  }

  // Step 5: Fix SVG image hrefs
  const svgRe = /<image(?:.*)(?<href>href=".*")/gim;
  for (const match of [...processed.matchAll(svgRe)]) {
    const href = match.groups?.href;
    if (href) {
      processed = processed.replace(href, href.replace('href="', `href="${relDepth}`));
    }
  }

  // Step 6: Generate stylesheet link tags (same as original)
  const styleTags = spine.relativeStyleSheets.map(
    (ss) => `<link rel="stylesheet" type="text/css" href="${relDepth}${ss}"/>`,
  );

  // Step 7: Wrap in full HTML document if content starts with sbo-rt-content div
  if (processed.startsWith('<div id="sbo-rt-content"')) {
    processed = wrapHtml(book, relDepth, styleTags, processed);
  }

  return processed;
};

const watermarkPackageDoc = (xml: string, user: User): string => {
  try {
    const dcTitleRe = /(?<start><dc:title[^>]*>)(?<title>[^<]+)(?=<\/dc:title>)/g;
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = dcTitleRe.exec(xml)) !== null) {
      matches.push(match);
    }

    const groups = matches
      .map((m) => m.groups)
      .filter((g): g is { start: string; title: string; end: string } => g !== undefined);
    const titleParts = groups.map((g) => g.title).join(" - ");
    const cleanedTitle = titleParts.replaceAll(/\p{Z}/gu, " ");
    const watermarked = `${cleanedTitle} (for ${user.first_name} ${user.last_name})`;

    const first = groups[0];
    if (!first) return xml;
    const origEntry = first.start + first.title + first.end;
    const newEntry = first.start + watermarked + first.end;
    xml = xml.replace(origEntry, newEntry);

    for (let i = 1; i < groups.length; i++) {
      const entry = groups[i]!;
      const full = entry.start + entry.title + entry.end;
      xml = xml.replace(full, "");
    }

    return xml;
  } catch (e) {
    console.warn("Error trying to watermark ePub, carrying on", e);
    return xml;
  }
};

function generateMinimalOpf(
  book: EpubBookJson,
  files: ManifestFile[],
  opfPath: string,
): string {
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);

  const items: string[] = [];
  const refs: string[] = [];
  let index = 0;

  for (const file of files) {
    if (file.full_path === "mimetype" || file.full_path === "META-INF/container.xml") {
      continue;
    }

    const itemId = `item_${index++}`;
    const href = file.full_path.startsWith(opfDir)
      ? file.full_path.slice(opfDir.length)
      : "../" + file.full_path;
    const mediaType = file.media_type ?? "application/octet-stream";

    items.push(`    <item id="${itemId}" href="${href}" media-type="${mediaType}"/>`);
    refs.push(`    <itemref idref="${itemId}"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${htmlEncode(book.title)}</dc:title>
    <dc:identifier id="book-id">${book.identifier}</dc:identifier>
    <dc:language>${book.language}</dc:language>
  </metadata>
  <manifest>
${items.join("\n")}
  </manifest>
  <spine>
${refs.join("\n")}
  </spine>
</package>`;
}

export class EpubProcessor {
  constructor(
    private readonly http: IHttpClient,
    private readonly storage: IStorage,
  ) {}

  async cacheEbookToDisk(
    book: EpubBookJson,
    files: FileListResponse,
    cacheDir: string,
    callbacks?: ProgressCallbacks,
  ): Promise<Manifest> {
    const manifestFiles: ManifestFile[] = [];
    const registered: string[] = [];

    const saveFile = async (relPath: string, data: Uint8Array, kind: string, mediaType?: string): Promise<void> => {
      const fullPath = this.storage.resolve(cacheDir, relPath);
      await this.storage.ensureDir(fullPath);
      await this.storage.writeFile(fullPath, data);
      if (!registered.includes(relPath)) {
        registered.push(relPath);
        manifestFiles.push({
          kind,
          full_path: relPath,
          media_type: mediaType,
          size: data.length,
        });
      }
    };

    const spine = await this.fetchSpineInfo(book);
    await saveFile("mimetype", strToU8("application/epub+zip"), "other_asset", "text/plain");

    const chunks = getArrayChunks(files.results, 10);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      if (callbacks?.cbBatchProgress) {
        callbacks.cbBatchProgress({ current: i + 1, total: chunks.length });
      }

      await Promise.all(
        chunk.map(async (file) => {
          const contents = await this.fetchFileContents(book, file, spine, callbacks);

          if (file.media_type === "application/oebps-package+xml") {
            const containerXml = `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="${"OEBPS/" + file.full_path}" media-type="${file.media_type}"/></rootfiles></container>`;
            await saveFile("META-INF/container.xml", strToU8(containerXml), "other_asset", "application/xml");
          }

          const relPath = "OEBPS/" + file.full_path;
          await saveFile(relPath, contents, file.kind, file.media_type);
        }),
      );

      await sleep(1000);
    }

    await saveFile(
      "META-INF/com.apple.ibooks.display-options.xml",
      strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><display_options><platform name="*"><option name="specified-fonts">true</option></platform></display_options>',
      ),
      "other_asset",
      "application/xml",
    );

    // Generate OPF if not provided by API
    const hasOpf = manifestFiles.some(
      (f) => f.media_type === "application/oebps-package+xml" || f.full_path.endsWith(".opf"),
    );
    if (!hasOpf) {
      const opfPath = "OEBPS/package.opf";
      const opfContent = generateMinimalOpf(book, manifestFiles, opfPath);
      await saveFile(opfPath, strToU8(opfContent), "other_asset", "application/oebps-package+xml");

      const containerXml = `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/></rootfiles></container>`;
      await saveFile("META-INF/container.xml", strToU8(containerXml), "other_asset", "application/xml");
    }

    const manifest: Manifest = {
      _type: "ebook-manifest",
      version: 1,
      contentType: "book",
      title: book.title,
      identifier: book.identifier,
      language: book.language,
      ourn: book.ourn,
      created: new Date().toISOString(),
      files: manifestFiles,
      spine: {
        styleSheets: spine.styleSheets,
        relativeStyleSheets: spine.relativeStyleSheets,
      },
    };

    await this.storage.writeFile(
      this.storage.resolve(cacheDir, "manifest.json"),
      strToU8(JSON.stringify(manifest, null, 2)),
    );

    return manifest;
  }

  private async fetchSpineInfo(book: EpubBookJson): Promise<SpineInfo> {
    const spineRes = await this.http.fetch(`${book.spine}?limit=2`);
    const spineData = await spineRes.json<{ results: Array<{ url: string }> }>();
    const lastItem = spineData.results[spineData.results.length - 1]!;
    const spineMeta = await (await this.http.fetch(lastItem.url)).json<{
      related_assets: { stylesheets: Record<string, string> };
    }>();
    const styleSheets = Object.values(spineMeta.related_assets.stylesheets);
    const relativeStyleSheets = styleSheets.map((s) => s.replace(book.files, ""));
    return { styleSheets, relativeStyleSheets };
  }

  private async fetchFileContents(
    book: EpubBookJson,
    file: EpubFileItem,
    spine: SpineInfo,
    callbacks?: ProgressCallbacks,
  ): Promise<Uint8Array> {
    switch (file.kind) {
      case "image": {
        const buf = await (await this.http.fetch(file.url)).arrayBuffer();
        return new Uint8Array(buf);
      }
      case "chapter": {
        const text = await (await this.http.fetch(file.url)).text();
        const processed = processChapter(book, file, spine, text);
        return strToU8(processed);
      }
      case "stylesheet": {
        const text = await (await this.http.fetch(file.url)).text();
        return strToU8(text);
      }
      case "other_asset": {
        return this.fetchOtherAsset(book, file, callbacks);
      }
      default: {
        const buf = await (await this.http.fetch(file.url)).arrayBuffer();
        return new Uint8Array(buf);
      }
    }
  }

  private async fetchOtherAsset(
    book: EpubBookJson,
    file: EpubFileItem,
    callbacks?: ProgressCallbacks,
  ): Promise<Uint8Array> {
    switch (file.media_type) {
      case "application/oebps-package+xml": {
        const pkgText = await (await this.http.fetch(file.url)).text();
        const processed = callbacks && !callbacks.byPass && callbacks.user
          ? watermarkPackageDoc(pkgText, callbacks.user)
          : pkgText;
        return strToU8(processed);
      }
      case "application/x-dtbncx+xml": {
        let ncxText = await (await this.http.fetch(file.url)).text();
        if (!ncxText.includes("?xml version=")) {
          ncxText = '<?xml version="1.0" encoding="UTF-8"?>' + ncxText;
        }
        return strToU8(ncxText);
      }
      case "application/xhtml+xml":
      case "text/html":
      case "text/xml": {
        const markup = await (await this.http.fetch(file.url)).text();
        return strToU8(stripScriptsAndLinks(markup));
      }
      default: {
        const buf = await (await this.http.fetch(file.url)).arrayBuffer();
        return new Uint8Array(buf);
      }
    }
  }
}
