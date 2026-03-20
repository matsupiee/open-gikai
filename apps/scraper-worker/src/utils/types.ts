/**
 * rawText から解析された1発言分のデータ。
 * 各 system type の to-statements.ts が生成し、apply-statements.ts が DB に挿入する。
 */
export interface ParsedStatement {
  kind: string;
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
  contentHash: string;
  startOffset: number;
  endOffset: number;
}

export interface MeetingData {
  municipalityId: string;
  title: string;
  meetingType: string;
  heldOn: string; // YYYY-MM-DD
  sourceUrl: string | null;
  externalId: string | null;
  statements: ParsedStatement[];
}

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
 */
export type ScraperQueueMessage =
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
    }
  | {
      /** dbsr.jp: 議事録一覧ページから ID 一覧を取得するメッセージ */
      type: "dbsearch:list";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      baseUrl: string;
      year: number;
    }
  | {
      /** dbsr.jp: 議事録詳細ページを取得・保存するメッセージ */
      type: "dbsearch:detail";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      baseUrl: string;
      meetingId: string;
      detailUrl: string;
      /** 一覧ページから取得したタイトル（詳細ページにタイトルがない場合のフォールバック） */
      listTitle?: string;
    }
  | {
      /** kensakusystem.jp: 議事録一覧ページから一覧を取得するメッセージ */
      type: "kensakusystem:list";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      baseUrl: string;
      year: number;
    }
  | {
      /** kensakusystem.jp: 議事録詳細ページを取得・保存するメッセージ */
      type: "kensakusystem:detail";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      slug: string;
      title: string;
      heldOn: string;
      detailUrl: string;
    }
  | {
      /** gijiroku.com: voiweb.exe CGI から会議一覧を取得するメッセージ */
      type: "gijiroku-com:list";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      baseUrl: string;
      year: number;
    }
  | {
      /** gijiroku.com: voiweb.exe CGI から議事録本文を取得・保存するメッセージ */
      type: "gijiroku-com:detail";
      jobId: string;
      municipalityId: string;
      municipalityName: string;
      prefecture: string;
      baseUrl: string;
      /** FINO パラメータ（ファイル番号） */
      fino: string;
      /** KGNO パラメータ（会議番号） */
      kgno: string;
      /** UNID パラメータ（一意識別子） */
      unid: string;
      /** 会議タイトル */
      title: string;
      /** 日付ラベル（例: "12月05日-01号"） */
      dateLabel: string;
    };

/** Cloudflare Worker の環境変数（bindings） */
export interface Env {
  DATABASE_URL: string;
  SCRAPER_QUEUE: Queue<ScraperQueueMessage>;
  OPENAI_API_KEY?: string;
}
