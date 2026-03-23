/**
 * 朝来市議会 会議録検索システム — detail フェーズ
 *
 * ASP.NET postback でドロップダウンを順次選択し、
 * 会議録本文を取得して発言をパースする。
 *
 * 会議録は <div id='NNN'> 形式で各発言が格納されており、
 * "NNN ○ROLE（NAME君）" パターンで話者を識別する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  buildYearLabel,
  detectMeetingType,
  extractAspNetFields,
  fetchInitialPage,
  postBack,
} from "./shared";

/** postback 間のウェイト (ms) */
const DELAY_MS = 1_500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "副部長",
  "副課長",
  "支所長",
  "理事",
]);

/**
 * 発言ヘッダーから話者名・役職・本文を抽出する。
 *
 * フォーマット: "○ROLE（NAME君）　本文..."
 * 例: "○議長（森田　龍司君）　ただいまから会議を開きます。"
 * 例: "○議員（17番　渕本　　稔君）　質問いたします。"
 * 例: "○政策担当部長（掃部　直樹君）　お答えします。"
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○マーカーを除去
  const stripped = text.replace(/^[○◯]\s*/, "");

  // "ROLE（NAME君）" パターンにマッチ
  const headerMatch = stripped.match(
    /^([^（]+)（([^）]+?)君?）[\s　]*([\s\S]*)/,
  );

  if (!headerMatch) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const role = headerMatch[1]!.trim();
  let name = headerMatch[2]!.trim();
  const content = headerMatch[3]!.trim();

  // 名前から議席番号を除去: "17番　渕本　　稔" → "渕本　稔"
  name = name.replace(/^\d+番[\s　]+/, "");

  // 名前中の空白を完全除去（他のアダプターと統一）
  name = name.replace(/[\s　]+/g, "").trim();

  return { speakerName: name, speakerRole: role, content };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  ) {
    return "remark";
  }
  if (speakerRole === "議員") return "question";
  // 行政側の完全一致
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  // 行政側の部分一致（"政策担当部長" → "部長" を含む）
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 会議録 HTML から発言を抽出する。
 *
 * 各発言は <div id='NNN'> に格納されており、
 * ヘッダーは <font> タグ内の "NNN ○ROLE（NAME君）" 形式。
 * 本文は </font></b> 以降のテキスト。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // <div id='NNN' で始まるブロックを抽出
  const divRegex = /<div id='(\d{3})'([\s\S]*?)(?=<div id='\d{3}'|$)/g;
  let offset = 0;

  for (const divMatch of html.matchAll(divRegex)) {
    const divContent = divMatch[2];
    if (!divContent) continue;

    // HTML タグを除去してプレーンテキストにする
    const plainText = divContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<\/br>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();

    if (!plainText) continue;

    // ヘッダー "NNN ○ROLE（NAME君）" を除去してマーカーチェック
    const headerRemoved = plainText.replace(/^\d{3}\s*/, "");
    const hasMarker = /^[○◯]/.test(headerRemoved);

    if (hasMarker) {
      const { speakerName, speakerRole, content } =
        parseSpeaker(headerRemoved);
      if (!content) continue;

      // 改行を正規化
      const normalizedContent = content.replace(/\n[\s　]*/g, "\n").trim();

      const contentHash = createHash("sha256")
        .update(normalizedContent)
        .digest("hex");
      const startOffset = offset;
      const endOffset = offset + normalizedContent.length;

      statements.push({
        kind: classifyKind(speakerRole),
        speakerName,
        speakerRole,
        content: normalizedContent,
        contentHash,
        startOffset,
        endOffset,
      });

      offset = endOffset + 1;
    }
  }

  return statements;
}

/**
 * ASP.NET postback で会議録 HTML を取得する。
 *
 * 年度 → 会議種別 → 開催回次 → 会議名 の順でドロップダウンを選択し、
 * レスポンスに含まれる会議録本文を返す。
 */
export async function fetchMeetingContent(
  year: number,
  kind: string,
  kaisu: string,
  meetingName: string,
): Promise<string | null> {
  const yearLabel = buildYearLabel(year);

  const { html: initialHtml, sessionCookie } = await fetchInitialPage();

  // Step 1: 年度選択
  let fields = extractAspNetFields(initialHtml);
  await delay(DELAY_MS);
  const htmlAfterYear = await postBack(
    sessionCookie,
    fields,
    "ASPxPageControl$ASPxComboBYearL",
    { "ASPxPageControl$ASPxComboBYearL": yearLabel },
  );

  // Step 2: 会議種別選択
  fields = extractAspNetFields(htmlAfterYear);
  await delay(DELAY_MS);
  const htmlAfterKind = await postBack(
    sessionCookie,
    fields,
    "ASPxPageControl$ASPxComboBKind",
    {
      "ASPxPageControl$ASPxComboBYearL": yearLabel,
      "ASPxPageControl$ASPxComboBKind": kind,
    },
  );

  // Step 3: 開催回次選択
  fields = extractAspNetFields(htmlAfterKind);
  await delay(DELAY_MS);
  const htmlAfterKaisu = await postBack(
    sessionCookie,
    fields,
    "ASPxPageControl$ASPxComboBKaisuL",
    {
      "ASPxPageControl$ASPxComboBYearL": yearLabel,
      "ASPxPageControl$ASPxComboBKind": kind,
      "ASPxPageControl$ASPxComboBKaisuL": kaisu,
    },
  );

  // Step 4: 会議名選択 → 会議録本文がレスポンスに含まれる
  fields = extractAspNetFields(htmlAfterKaisu);
  await delay(DELAY_MS);
  const htmlWithContent = await postBack(
    sessionCookie,
    fields,
    "ASPxPageControl$ASPxComboBNameL",
    {
      "ASPxPageControl$ASPxComboBYearL": yearLabel,
      "ASPxPageControl$ASPxComboBKind": kind,
      "ASPxPageControl$ASPxComboBKaisuL": kaisu,
      "ASPxPageControl$ASPxComboBNameL": meetingName,
    },
  );

  // 会議録本文が含まれているか確認
  if (!htmlWithContent.includes("<div id='001'")) return null;

  return htmlWithContent;
}

/**
 * 会議録 HTML から MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: {
    title: string;
    heldOn: string;
    kind: string;
    kaisu: string;
    year: number;
  },
  municipalityId: string,
): Promise<MeetingData | null> {
  const html = await fetchMeetingContent(
    doc.year,
    doc.kind,
    doc.kaisu,
    doc.title,
  );
  if (!html) return null;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  // externalId: 年度_種別_回次_会議名のハッシュで一意にする
  const externalId = `asago_${createHash("md5").update(doc.title).digest("hex").slice(0, 12)}`;

  return {
    municipalityId,
    title: doc.title,
    meetingType: detectMeetingType(doc.title),
    heldOn: doc.heldOn,
    sourceUrl: null,
    externalId,
    statements,
  };
}
