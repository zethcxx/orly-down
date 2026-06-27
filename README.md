# My Online Learning Downloader CLI

CLI tool for downloading content from O'Reilly Media (learning.oreilly.com). Supports **ebooks** (EPUB) and **courses/videos** (MP4).

## Features

- **Ebook download** — Downloads complete books with images, stylesheets, and chapters in EPUB format.
- **Course download** — Downloads MP4 videos organized by module, including subtitles when available.
- **Automatic quality selection** — Automatically picks the best available video flavor.
- **Cache resume** — Rebuilds an EPUB from previously cached files without network access.
- **Proxy support** — HTTP and SOCKS5 proxies.
- **Exponential backoff retries** — Automatically retries on network failures and 5xx/429 errors.
- **Watermark bypass** — Option to skip watermarking on ebooks.
- **Multiple auth formats** — Cookie string, Netscape cookies.txt file, or JSON (EditThisCookie).

## Requirements

- **Node.js >= 18** or **Bun**
- An active O'Reilly Media subscription

## Installation

```bash
git clone https://github.com/zethcxx/orly-down
cd orly-down
pnpm install
```

## Usage

```bash
# Development
pnpm start -- --url <url> --cookie "<cookies>" [options]

# Build and run
pnpm build
node dist/main.js --url <url> --cookie "<cookies>" [options]

# With Bun
bun run src/cli/main.ts --url <url> --cookie "<cookies>" [options]
```

### Options

| Option                   | Description                                                |
|--------------------------|------------------------------------------------------------|
| `--url, -u <url>`        | URL of the content to download                             |
| `--cookie, -c <string>`  | Cookie string (e.g., `"orm-jwt=...; orm-rt=..."`)          |
| `--cookie-file <path>`   | Netscape cookies.txt file                                  |
| `--cookie-json <path>`   | Cookie JSON file (EditThisCookie or flat object)           |
| `--type, -t <type>`      | Content type: `course`, `ebook` or `auto` (default: `auto`)|
| `--output, -o <dir>`     | Output directory (default: `downloads`)                    |
| `--bypass-watermark, -w` | Skip watermark on ebooks                                   |
| `--max-retries <n>`      | Maximum retries (default: 3)                               |
| `--base-delay <ms>`      | Base delay in ms for backoff (default: 1000)               |
| `--proxy <url>`          | Proxy URL (`http://...` or `socks5://...`)                 |
| `--help, -h`             | Show help                                                  |

> **Note:** One of `--cookie`, `--cookie-file`, or `--cookie-json` is required.

## Authentication

Access requires an active subscription logged in the browser. Cookies can be obtained from the browser's developer console and provided in three formats.

### Obtaining cookies from the browser

1. Log in to [learning.oreilly.com](https://learning.oreilly.com) in your browser.
2. Open DevTools (F12) and go to the **Console** tab.
3. Paste the following JavaScript snippet and press Enter:

```js
copy(JSON.stringify(document.cookie.split(';').map(c => c.split('=')).map(i => [i[0].trim(), i[1].trim()]).reduce((r, i) => {r[i[0]] = i[1]; return r;}, {})))
```

4. The cookies JSON object is now in your clipboard.

### Cookie string (`--cookie`)

Paste the cookies directly as a semicolon-separated string:

```bash
pnpm start -- --url <url> -c "orm-jwt=<token>; orm-rt=<token>"
```

### JSON (`--cookie-json`)

Save the clipboard content to a file (e.g., `cookies.json`) and pass it:

```bash
pnpm start -- --url <url> --cookie-json cookies.json
```

### Netscape cookies.txt (`--cookie-file`)

If you export cookies in Netscape format (e.g., via browser extensions):

```bash
pnpm start -- --url <url> --cookie-file cookies.txt
```

## Examples

### Download an ebook
```bash
pnpm start -- --url "https://learning.oreilly.com/library/view/title/1234567890/" -c "orm-jwt=token; orm-rt=token"
```

### Download a course
```bash
pnpm start -- --url "https://learning.oreilly.com/course/1234567890/" -c "orm-jwt=token; orm-rt=token"
```

### Download with proxy
```bash
pnpm start -- --url <url> -c "orm-jwt=token; orm-rt=token" --proxy "http://127.0.0.1:8080"
```

### Using a cookie JSON file
```bash
pnpm start -- --url <url> --cookie-json cookies.json
```

## Output structure

```
downloads/
  ebook-title/
    ebook-title-identifier.epub
    cache/
      manifest.json
      OEBPS/
        ...
  Course Title/
    Module Name/
      video-title.mp4
      video-title.vtt
```

## License

This project is an open-source fork. Use at your own risk and respect O'Reilly Media's terms of service.

