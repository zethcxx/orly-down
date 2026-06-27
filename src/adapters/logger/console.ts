import type { ILogger } from "../../ports/logger";

export class ConsoleLogger implements ILogger
{
  info(message: string): void {
    console.log(`  ${message}`);
  }

  warn(message: string): void {
    console.warn(`  [x] Warn: ${message}`);
  }

  error(message: string): void {
    console.error(`  [x] Err: ${message}`);
  }

  progress(label: string, current: number, total: number): void {
    const pct = Math.round((current / total) * 100);
    console.log(`  ${label}: ${pct}% (${current}/${total})`);
  }

  batch(info: { current: number; total: number }): void {
    const pct = Math.round((info.current / info.total) * 100);
    console.log(`  Processing batch: ${pct}% (${info.current}/${info.total})`);
  }
}

