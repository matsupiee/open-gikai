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
      /** DiscussNet (ASP版): 自治体の議事録一覧ページを取得するメッセージ */
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
      /** DiscussNet (ASP版): 個別議事録ページを取得・保存するメッセージ */
      type: "discussnet-meeting";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      meetingUrl: string;
    }
  | {
      /**
       * DiscussNet SSP (SaaS版): council_id ごとに schedule 一覧を取得するメッセージ。
       * POST /dnp/search/minutes/get_schedule で schedule_id 一覧を取得し、
       * 各 schedule_id を discussnet-ssp-minute としてキューに投入する。
       */
      type: "discussnet-ssp-schedule";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      /** テナントスラッグ（URL パスから抽出: /tenant/{slug}/） */
      tenantSlug: string;
      /** テナント数値 ID（tenant.js から取得） */
      tenantId: number;
      /** 会議 ID */
      councilId: number;
      /** 会議名（例: "令和７年第４回定例会"） */
      councilName: string;
    }
  | {
      /**
       * DiscussNet SSP (SaaS版): schedule_id ごとに議事録本文を取得・保存するメッセージ。
       * POST /dnp/search/minutes/get_minute で本文を取得して DB に保存する。
       */
      type: "discussnet-ssp-minute";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      tenantSlug: string;
      tenantId: number;
      councilId: number;
      councilName: string;
      scheduleId: number;
      /** schedule 名（例: "11月27日－01号"） */
      scheduleName: string;
      /** member_list HTML: 開催日抽出に使用 */
      memberList: string;
    };

/** Cloudflare Worker の環境変数（bindings） */
export interface Env {
  DATABASE_URL: string;
  SCRAPER_QUEUE: Queue<ScraperQueueMessage>;
}
