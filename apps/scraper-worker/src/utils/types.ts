export type { ParsedStatement, MeetingData } from "@open-gikai/scrapers";

/** ローカル自治体スクレイパーのターゲット設定 */
export interface LocalScraperTarget {
  municipalityId: string;
  municipalityName: string;
  baseUrl: string;
  listSelector: string;
  contentSelector: string;
  dateSelector: string;
  titleSelector?: string;
}

/**
 * Cloudflare Queue に投入するメッセージの型定義。
 *
 * - scraper:list / scraper:detail — 汎用2フェーズメッセージ（ScraperAdapter 経由で処理）
 * - discussnet-ssp:* — 4フェーズの特殊ケース（個別ハンドラーで処理）
 */
export type ScraperQueueMessage =
  // ── 汎用 2フェーズメッセージ（registry に登録された adapter が処理） ──
  | {
      /** adapter の fetchList を呼び出す汎用 list メッセージ */
      type: "scraper:list";
      /** system_types.name（adapter の名前と一致） */
      systemType: string;
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      baseUrl: string;
      year: number;
    }
  | {
      /** adapter の fetchDetail を呼び出す汎用 detail メッセージ */
      type: "scraper:detail";
      /** system_types.name（adapter の名前と一致） */
      systemType: string;
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      /** list フェーズで生成された adapter 固有のパラメータ */
      detailParams: Record<string, unknown>;
    }
  // ── DiscussNet SSP（4フェーズの特殊ケース） ──
  | {
      /**
       * DiscussNet SSP (SaaS版): council_id ごとに schedule 一覧を取得するメッセージ。
       * POST /dnp/search/minutes/get_schedule で schedule_id 一覧を取得し、
       * 各 schedule_id を discussnet-ssp:minute としてキューに投入する。
       */
      type: "discussnet-ssp:schedule";
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
      /** 自ホスト版のホスト（省略時は ssp.kaigiroku.net） */
      host?: string;
    }
  | {
      /**
       * DiscussNet SSP (SaaS版): schedule_id ごとに議事録本文を取得・保存するメッセージ。
       * POST /dnp/search/minutes/get_minute で本文を取得して DB に保存する。
       */
      type: "discussnet-ssp:minute";
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
      /** 自ホスト版のホスト（省略時は ssp.kaigiroku.net） */
      host?: string;
    };

/** Cloudflare Worker の環境変数（bindings） */
export interface Env {
  DATABASE_URL: string;
  SCRAPER_QUEUE: Queue<ScraperQueueMessage>;
  OPENAI_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
}
