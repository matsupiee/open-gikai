import type { AssemblyLevel } from "@open-gikai/db/schema";

export interface MeetingData {
  title: string;
  meetingType: string;
  heldOn: string; // YYYY-MM-DD
  sourceUrl: string | null;
  assemblyLevel: AssemblyLevel;
  prefecture: string | null;
  municipality: string | null;
  externalId: string | null;
  rawText: string;
}

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
  from: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
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

/** DiscussNet スクレイパー設定 */
export interface DiscussnetScraperConfig {
  /** スクレイピング対象年（未指定の場合は全年） */
  year?: number;
  /** 1ジョブあたりの最大取得件数（テスト用） */
  limit?: number;
}

/**
 * Cloudflare Queue に投入するメッセージの型定義。
 * 各メッセージは 1 つの作業単位（1 council、1 NDL ページ、1 local target）を表す。
 */
export type ScraperQueueMessage =
  | {
      type: "start-job";
      jobId: string;
    }
  | {
      type: "kagoshima-council";
      jobId: string;
      councilId: number;
      councilName: string;
      typeGroupNames: string[]; // council_type_name1/2/3 をフラットにした配列
      remainingCouncils: number; // 残りの council 数（進捗計算用）
    }
  | {
      type: "ndl-page";
      jobId: string;
      from: string;
      until: string;
      startRecord: number;
      limit?: number;
      fetchedSoFar: number;
    }
  | {
      type: "local-target";
      jobId: string;
      target: LocalScraperTarget;
      limit?: number;
    }
  | {
      /** DiscussNet: 自治体の議事録一覧ページを取得するメッセージ */
      type: "discussnet-list";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      baseUrl: string;
      year?: number;
      page: number;
      limit?: number;
    }
  | {
      /** DiscussNet: 個別議事録ページを取得・保存するメッセージ */
      type: "discussnet-meeting";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      meetingUrl: string;
    };

/** Cloudflare Worker の環境変数（bindings） */
export interface Env {
  DATABASE_URL: string;
  SCRAPER_QUEUE: Queue<ScraperQueueMessage>;
}
