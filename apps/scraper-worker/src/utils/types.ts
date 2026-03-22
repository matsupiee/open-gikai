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
 * 全ての system_type は scraper:list / scraper:detail の汎用メッセージで処理される。
 * ScraperAdapter の fetchList / fetchDetail が実際の処理を担う。
 */
export type ScraperQueueMessage =
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
    };

/** Cloudflare Worker の環境変数（bindings） */
export interface Env {
  DATABASE_URL: string;
  SCRAPER_QUEUE: Queue<ScraperQueueMessage>;
  OPENAI_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
}
