export interface MeetingData {
  title: string;
  meetingType: string;
  heldOn: string; // YYYY-MM-DD
  sourceUrl: string | null;
  assemblyLevel: "national" | "prefectural" | "municipal";
  prefecture: string | null;
  municipality: string | null;
  externalId: string | null;
  rawText: string;
}

/** ログ書き込み関数。スクレイパーから進捗を報告するために使う */
export type Logger = (level: "info" | "warn" | "error", message: string) => void | Promise<void>;

/** ローカル自治体スクレイパーのターゲット設定 */
export interface LocalScraperTarget {
  prefecture: string;
  municipality: string;
  assemblyLevel: "prefectural" | "municipal";
  baseUrl: string;
  listSelector: string;
  contentSelector: string;
  dateSelector: string;
  titleSelector?: string;
}

/** NDL スクレイパー設定 */
export interface NdlScraperConfig {
  from: string;   // YYYY-MM-DD
  until: string;  // YYYY-MM-DD
  limit?: number;
}

/** 鹿児島市スクレイパー設定 */
export interface KagoshimaScraperConfig {
  year?: number;
  limit?: number;
}

/** ローカル自治体スクレイパー設定 */
export interface LocalScraperConfig {
  targets: LocalScraperTarget[];
  limit?: number;
}
