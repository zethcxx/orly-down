export const getArrayChunks = <T>(arr: T[], size: number): T[][] =>
  Array(Math.ceil(arr.length / size))
    .fill(null)
    .map((_, i) => i * size)
    .map((start) => arr.slice(start, start + size));

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const formatFileSize = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";
  const k      = 1000;
  const dm     = decimals;
  const i      = Math.floor(Math.log(bytes) / Math.log(k));
  const sizes  = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const parsed = sizes[i];
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${parsed ?? "Bytes"}`;
};

export const padZeroes = (num: number, length = 2): string =>
  num.toString().padStart(length, "0");

export const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-GB", {
    year : "numeric",
    month: "long",
    day  : "numeric",
  }).format(date);

export const formatDateTimestamp = (ts: number): string =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12   : false,
  }).format(new Date(ts));

const INVALID_CHARS = /[/?"|*<>%\\]/gi;

export const replaceInvalidFileNameCharacters = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  let result = input;
  if (result.startsWith("."))
    result = result.substring(1);

  if (result.endsWith("."))
    result = result.substring(0, result.length - 1);

  if (result.startsWith(String.fromCodePoint(160)))
    result = result.substring(1);

  result = result.replaceAll(":", " -");
  result = result.replace(INVALID_CHARS, "");
  result = result.replace(/\t/gi, " ");

  return result.trim();
};

export const replaceInvalidDirectoryCharacters = (input: string): string =>
  replaceInvalidFileNameCharacters(input).replaceAll(" & ", " and ");

export const htmlEncode = (str: string): string =>
  str.replaceAll("&", "&amp;");

export const getProgressSvg = (current: number, total: number, size = 20): string => {
  const circumference = Math.PI * (size / 2 - 2) * 2;
  const dashOffset = Math.round(((100 - (current / total) * 100) / 100) * circumference);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" version="1.1" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(-90deg)">
    <circle r="${size / 2 - 2}" cx="${size / 2}" cy="${size / 2}" stroke="rgb(211, 0, 45)" stroke-width="3" stroke-linecap="round" stroke-dashoffset="${dashOffset}px" fill="transparent" stroke-dasharray="${circumference}px"></circle>
  </svg>`;
};

