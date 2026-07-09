export interface CliOptions
{
  urls            : string[];
  type            : "course" | "ebook" | "auto";
  cookie         ?: string;
  cookieFile     ?: string;
  cookieJson     ?: string;
  output          : string;
  byPassWatermark : boolean;
  maxRetries      : number;
  baseDelay       : number;
  proxy          ?: string;
  parallel        : boolean;
}

export function parseArgs(): CliOptions
{
  const args = process.argv.slice(2);
  const options: CliOptions = {
    urls           : [],
    type           : "auto",
    output         : "downloads",
    byPassWatermark: false,
    maxRetries     : 3,
    baseDelay      : 1000,
    parallel       : false,
  };

  for ( let i = 0; i < args.length; i++ ) {
    const arg  = args[i]!;
    const next = args[i + 1];

    switch ( arg ) {
      case "--url":
      case "-u":
        if (next) { options.urls.push(next); i++; }
        break;
      case "--type":
      case "-t":
        if (next && ["course", "ebook", "auto"].includes(next)) {
          options.type = next as "course" | "ebook" | "auto";
          i++;
        }
        break;
      case "--cookie":
      case "-c":
        if (next) { options.cookie = next; i++; }
        break;
      case "--cookie-file":
        if (next) { options.cookieFile = next; i++; }
        break;
      case "--cookie-json":
        if (next) { options.cookieJson = next; i++; }
        break;
      case "--output":
      case "-o":
        if (next) { options.output = next; i++; }
        break;
      case "--bypass-watermark":
      case "-w":
        options.byPassWatermark = true;
        break;
      case "--max-retries":
        if (next) { options.maxRetries = parseInt(next, 10) || 3; i++; }
        break;
      case "--base-delay":
        if (next) { options.baseDelay = parseInt(next, 10) || 1000; i++; }
        break;
      case "--proxy":
        if (next) { options.proxy = next; i++; }
        break;
      case "--parallel":
      case "-p":
        options.parallel = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  if (options.urls.length === 0) {
    console.error("  Error: --url is required");
    printHelp();
    process.exit(1);
  }

  if (!options.cookie && !options.cookieFile && !options.cookieJson) {
    console.error("  Error: --cookie, --cookie-file, or --cookie-json is required");
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp(): void {
  console.log(`
  Usage: npx tsx src/cli/main.ts [options]

  Required:
    --url, -u       <url>           URL of the content to download (can be repeated)
    --cookie, -c    <string>        Cookie string (e.g., "orm-jwt=...; orm-rt=...")
    --cookie-file   <path>          Netscape cookies.txt file
    --cookie-json   <path>          Cookie JSON file (EditThisCookie or flat object)
    * One of --cookie, --cookie-file, or --cookie-json is required

  Options:
    --type, -t      <type>          Content type: course | ebook | auto (default: auto)
    --output, -o    <dir>           Output directory (default: downloads)
    --bypass-watermark, -w          Skip watermarking
    --max-retries   <n>             Max retries for failed requests (default: 3)
    --base-delay    <ms>            Base delay in ms for retry backoff (default: 1000)
    --proxy         <url>           Proxy URL (http:// or socks5://)
    --parallel, -p                  Download multiple URLs in parallel
    --help, -h                      Show this help
`);
}

