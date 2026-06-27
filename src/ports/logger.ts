export interface ILogger {
  info (message: string): void;
  warn (message: string): void;
  error(message: string): void;

  progress(label: string, current: number, total: number): void;
  batch(info: { current: number; total: number }): void;
}

