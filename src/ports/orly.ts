import type { EpubBookJson, FileListResponse, TableOfContents, User } from "../domain/entities";

export interface IOrlyApi {
  getBookJson(originUrl: string, toc: Record<string, string>): Promise<EpubBookJson>;

  getFileList(book: EpubBookJson): Promise<FileListResponse>;
  fetchTableOfContents(url: string): Promise<Record<string, string> | null>;

  getUserStatus(originUrl: string): Promise<{ reason: string; canProceed: boolean }>;
  getUser      (originUrl: string): Promise<User>;

  getCourseData           (productId: string, originUrl   : string): Promise<{ title: string }>;
  getCourseTableOfContents(productId: string, originUrl   : string): Promise<TableOfContents>;

  getEntryRecords(productId: string, referenceIds: string[], originUrl: string): Promise<import("../domain/entities").EntryRecord[]>;
}

