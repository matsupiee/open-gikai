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

/**
 * Cloudflare Queue に投入するメッセージの型定義。
 * discussnet-list / discussnet-meeting は scheduled の dispatchJob から投入される。
 */
export type ScraperQueueMessage =
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
