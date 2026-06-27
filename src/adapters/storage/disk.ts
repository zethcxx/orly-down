import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync                 } from "node:fs"         ;
import { resolve, dirname           } from "node:path"       ;

import type { IStorage } from "../../ports/storage";

export class DiskStorage implements IStorage {
  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    await ensureDir(filePath);
    await writeFile(filePath, data);
  }

  async readFile(filePath: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(filePath));
  }

  async readTextFile(filePath: string): Promise<string> {
    return readFile(filePath, "utf-8");
  }

  exists(filePath: string): boolean {
    return existsSync(filePath);
  }

  async ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  resolve(...paths: string[]): string {
    return resolve(...paths);
  }
}

async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

