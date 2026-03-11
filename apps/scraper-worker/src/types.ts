import type { LocalScraperTarget } from "@open-gikai/scraper";

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
    };

/** Cloudflare Worker の環境変数（bindings） */
export interface Env {
  DATABASE_URL: string;
  SCRAPER_QUEUE: Queue<ScraperQueueMessage>;
}
