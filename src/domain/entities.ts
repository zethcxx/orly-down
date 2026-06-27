export interface User {
  email         : string;
  user_type     : string;
  expired_trial?: boolean;
  trial        ?: { trial_expiration_date: string };
  subscription  : {
    active: boolean;
    cancellation_date: string | null;
  };
  first_name: string;
  last_name : string;
}

export interface UserStatus {
  reason    : string;
  canProceed: boolean;
}

export interface VideoClip {
  id          : string;
  title       : string;
  duration    : number;
  referenceId?: string;
}

export interface CourseData {
  title           : string;
  publication_date: string;
  video_clips     : VideoClip[];
}

export interface TOCEntry {
  title       : string;
  depth       : number;
  reference_id: string;
  ourn        : string | null;
}

export interface TableOfContents {
  toc: TOCEntry[];
}

export interface EntryRecord {
  entryId    : string;
  referenceId: string;
  title      : string;
}

export interface ProgressInfo {
  current: number;
  total  : number;
}

export interface ProgressCallbacks {
  cbBatchProgress?: (info: ProgressInfo) => void;

  byPass?: boolean;
  user  ?: User;
}

export interface KalturaSession {
  session: string;
  expiry : string;
}

export interface KalturaConfig {
  partner_id: number;
}

export interface KalturaFilterPager {
  objectType: "KalturaFilterPager";
  pageSize  : number;
  pageIndex : number;
}

export interface KalturaBodyBase {
  apiVersion: string;
  format    : number;
  ks        : string | undefined;
  clientTag : string;
  partnerId : number | null;
  p        ?: number | null;
}

export interface MediaEntryFilterBody extends KalturaBodyBase {
  service: "media";
  action : "list";
  filter : {
    objectType   : string;
    referenceIdIn: string;
    statusIn     : string;
  };
  pager: KalturaFilterPager;
}

export interface AssetFilterBody extends KalturaBodyBase {
  service: string;
  action : "list";
  filter : {
    objectType: string;
    entryIdIn : string;
    statusIn  : string;
  };
  pager: KalturaFilterPager;
}

export interface DownloadUrlBody extends KalturaBodyBase {
  id: string;
}

export interface MediaEntry {
  objects   : KalturaMediaObject[];
  totalCount: number;
}

export interface KalturaMediaObject {
  id          : string;
  entryId    ?: string;
  referenceId?: string;
  title      ?: string;
}

export interface FlavorAsset extends KalturaMediaObject {
  entryId      : string;
  videoCodecId?: string;
  height      ?: number;
  bitrate      : number;
  fileExt      : string;
  size         : number;
  id           : string;
}

export interface CaptionAsset extends KalturaMediaObject {
  entryId      : string;
  label       ?: string;
  language     : string;
  languageCode : string;
  fileExt      : string;
  id           : string;
}

export interface DownloadItem {
  flavorId    ?: string;
  captionId   ?: string;
  title        : string;
  parentTitle ?: string;
  courseTitle ?: string;
  fileExt      : string;
  fileSize     : number;
  resolution  ?: number | string;
  index       ?: number;
  isAudio     ?: boolean;
  languageCode?: string;
}

export interface DownloadableItem {
  url       : string;
  filename  : string;
  fileSize ?: number;
}

export interface ZipEntry {
  file        : EpubFileInfo;
  fileContents: Uint8Array;
}

export interface EpubFileInfo {
  kind       : string;
  full_path  : string;
  media_type?: string;
  url       ?: string;
}

export interface EpubBookJson {
  title     : string;
  identifier: string;
  language  : string;
  ourn      : string;
  files     : string;
  spine     : string;
}

export interface FileListResponse {
  count   : number;
  results : EpubFileItem[];
  next   ?: string | null;
}

export interface EpubFileItem {
  kind       : string;
  full_path  : string;
  url        : string;
  media_type?: string;
}

export interface SpineInfo {
  styleSheets        : string[];
  relativeStyleSheets: string[];
}

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  iv        : Uint8Array;
  authTag   : Uint8Array;
  salt      : Uint8Array;
  password  : string;
}

export interface AppState {
  tableOfContents: Record<string, string>;
}

export interface WaMessage {
  appState: AppState;
  content : { formatType: string };
  product : { identifier: string };
}

export interface AssetInfo {
  contentFormat: string;
  title        : string;
  courseTitle ?: string;
  referenceId ?: string;
  parentTitle ?: string;
  contentId   ?: string;
  content     ?: AssetInfo[];
  flavors     ?: FlavorAsset[];
  captions    ?: CaptionAsset[];
}

export interface BatchProgress {
  current: number;
  total  : number;
}

export type ContentType = "book" | "audiobook" | "course" | "video";

export interface ManifestFile {
  kind       : string;
  full_path  : string;
  media_type?: string;
  size       : number;
}

export interface Manifest {
  _type       : "ebook-manifest";
  version     : 1;
  contentType : ContentType;
  title       : string;
  identifier  : string;
  isbn       ?: string;
  language    : string;
  ourn        : string;
  cover      ?: string;
  created     : string;
  files       : ManifestFile[];
  spine       : {
    styleSheets        : string[];
    relativeStyleSheets: string[];
  };
}

