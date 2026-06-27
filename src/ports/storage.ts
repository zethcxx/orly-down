export interface IStorage {
  writeFile   (filePath: string, data: Uint8Array): Promise<void>;

  readFile    (filePath: string  ): Promise<Uint8Array>;
  readTextFile(filePath: string  ): Promise<string>    ;
  exists      (filePath: string  ): boolean            ;
  ensureDir   (filePath: string  ): Promise<void>      ;
  resolve     (...paths: string[]): string             ;
}

