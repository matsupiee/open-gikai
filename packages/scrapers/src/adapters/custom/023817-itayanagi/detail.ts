/**
 * 板柳町議会 — detail フェーズ
 *
 * 年度別本会議ページの特定セクションから議案・一般質問データを抽出し、
 * MeetingData に変換する。
 *
 * 板柳町は発言録の全文がなく、議案一覧と一般質問の主な項目のみ掲載。
 * 発言は「議員名 質問テーマ（h5）→ 詳細項目（h6）→ 箇条書き」として再構成する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchPage } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "副議長",
  "委員長",
  "副町長",
  "副議員",
  "議長",
  "町長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
]);

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "question" | "answer" | "remark" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/** HTML タグを除去してプレーンテキストに変換 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 議員名 h4 テキストから名前と会派を抽出する。
 * 例: 「長内　良蔵　議員（公正会）」→ { name: "長内 良蔵", faction: "公正会", role: "議員" }
 */
export function parseMemberName(text: string): {
  name: string | null;
  faction: string | null;
  role: string | null;
} {
  // 全角スペースを半角に正規化
  const normalized = text.replace(/　/g, " ").replace(/\s+/g, " ").trim();

  // 会派名を括弧から抽出（全角・半角括弧対応）
  const factionMatch = normalized.match(/[（(]([^）)]+)[）)]/);
  const faction = factionMatch?.[1]?.trim() ?? null;

  // 括弧部分を除いたテキスト
  const withoutFaction = normalized.replace(/[（(][^）)]*[）)]/g, "").trim();

  // 役職サフィックスを検出
  for (const suffix of ROLE_SUFFIXES) {
    if (withoutFaction.endsWith(suffix)) {
      const name = withoutFaction.slice(0, -suffix.length).trim() || null;
      return { name, faction, role: suffix };
    }
  }

  return { name: withoutFaction || null, faction, role: null };
}

/**
 * 年度別ページ HTML の特定セクション（sectionIndex 番目の h2 以降）から
 * 発言データを抽出する。
 */
export function parseDetailSection(
  html: string,
  sectionIndex: number,
): ParsedStatement[] {
  // h2 で分割して対象セクションを取得
  const h2SplitRegex = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
  const h2Matches = Array.from(html.matchAll(h2SplitRegex));

  // sectionIndex は年度タイトル（最初のh2）を除いた0始まり
  // 実際のh2インデックスは sectionIndex + 1
  const targetH2Index = sectionIndex + 1;

  if (targetH2Index >= h2Matches.length) return [];

  const targetMatch = h2Matches[targetH2Index];
  if (!targetMatch) return [];

  const sectionStart = targetMatch.index! + targetMatch[0].length;
  const nextH2 = h2Matches[targetH2Index + 1];
  const sectionEnd = nextH2?.index ?? html.length;

  const sectionHtml = html.slice(sectionStart, sectionEnd);

  const statements: ParsedStatement[] = [];
  let offset = 0;

  function addStatement(
    kind: "question" | "answer" | "remark",
    speakerName: string | null,
    speakerRole: string | null,
    content: string,
  ) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const contentHash = createHash("sha256").update(trimmed).digest("hex");
    statements.push({
      kind,
      speakerName,
      speakerRole,
      content: trimmed,
      contentHash,
      startOffset: offset,
      endOffset: offset + trimmed.length,
    });
    offset += trimmed.length + 1;
  }

  // 議決結果テーブルを抽出
  // tableタグを探してヘッダーが「議案番号」を含むものを対象
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  for (const tableMatch of sectionHtml.matchAll(tableRegex)) {
    const tableHtml = tableMatch[1]!;
    if (!tableHtml.includes("議案番号") && !tableHtml.includes("件名")) continue;

    // 各行を抽出
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let isFirst = true;
    for (const rowMatch of tableHtml.matchAll(rowRegex)) {
      const rowHtml = rowMatch[1]!;
      // ヘッダー行はスキップ
      if (isFirst) {
        isFirst = false;
        if (rowHtml.includes("<th") || rowHtml.includes("議案番号")) continue;
      }

      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      for (const cellMatch of rowHtml.matchAll(cellRegex)) {
        cells.push(stripHtml(cellMatch[1]!));
      }

      if (cells.length >= 3) {
        const billNumber = cells[0] ?? "";
        const billTitle = cells[2] ?? "";
        const result = cells[3] ?? "";
        if (billTitle && billNumber) {
          const content = result
            ? `${billNumber} ${billTitle}（${result}）`
            : `${billNumber} ${billTitle}`;
          addStatement("remark", null, null, content);
        }
      }
    }
    break; // 最初の議案テーブルのみ
  }

  // 一般質問セクションを処理
  // h4（議員名）ごとに発言を構成
  const h4Regex = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  const h4Matches = Array.from(sectionHtml.matchAll(h4Regex));

  for (let i = 0; i < h4Matches.length; i++) {
    const h4Match = h4Matches[i]!;
    const memberText = stripHtml(h4Match[1]!);
    const { name, faction, role } = parseMemberName(memberText);

    const speakerRole = role ?? "議員";
    const speakerName = name;
    const factionNote = faction ? `（${faction}）` : "";

    // この h4 から次の h4 までの範囲を取得
    const h4Start = h4Match.index! + h4Match[0].length;
    const nextH4 = h4Matches[i + 1];
    const h4End = nextH4?.index ?? sectionHtml.length;
    const memberSection = sectionHtml.slice(h4Start, h4End);

    // h5（質問テーマ）を抽出
    const h5Regex = /<h5[^>]*>([\s\S]*?)<\/h5>/gi;
    const h5Matches = Array.from(memberSection.matchAll(h5Regex));

    if (h5Matches.length === 0) {
      // h5がない場合は議員名のみを発言として追加
      const displayName = speakerName
        ? `${speakerName}${speakerRole}${factionNote}`
        : memberText;
      addStatement(classifyKind(speakerRole), speakerName, speakerRole, displayName);
      continue;
    }

    for (let j = 0; j < h5Matches.length; j++) {
      const h5Match = h5Matches[j]!;
      const theme = stripHtml(h5Match[1]!);

      // h5 から次の h5 までの範囲
      const h5Start = h5Match.index! + h5Match[0].length;
      const nextH5 = h5Matches[j + 1];
      const h5End = nextH5?.index ?? memberSection.length;
      const themeSection = memberSection.slice(h5Start, h5End);

      // h6 とその後の p タグ内容を収集して質問詳細を構成
      // 構造: <h6>サブテーマ</h6><p>詳細テキスト</p>
      const h6Regex = /<h6[^>]*>([\s\S]*?)<\/h6>([\s\S]*?)(?=<h6|$)/gi;
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;

      const details: string[] = [];

      for (const h6Match of themeSection.matchAll(h6Regex)) {
        const h6Title = stripHtml(h6Match[1]!);
        // h6 の後のテキスト（p タグなど）を取得
        const afterH6 = h6Match[2] ?? "";
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        const pTexts: string[] = [];
        for (const pMatch of afterH6.matchAll(pRegex)) {
          const pText = stripHtml(pMatch[1]!);
          if (pText) pTexts.push(pText);
        }
        const combined = pTexts.length > 0
          ? `${h6Title} ${pTexts.join(" ")}`
          : h6Title;
        if (combined) details.push(combined);
      }

      // h6 がなければ li を試みる
      if (details.length === 0) {
        for (const liMatch of themeSection.matchAll(liRegex)) {
          const liText = stripHtml(liMatch[1]!);
          if (liText) details.push(liText);
        }
      }

      const content =
        details.length > 0
          ? `${theme} ${details.join(" ")}`
          : theme;

      addStatement(classifyKind(speakerRole), speakerName, speakerRole, content);
    }
  }

  return statements;
}

/**
 * 年度別ページから特定会議の MeetingData を取得する。
 */
export async function fetchMeetingDetail(params: {
  pageUrl: string;
  sectionIndex: number;
  title: string;
  heldOn: string;
  municipalityId: string;
}): Promise<MeetingData | null> {
  const { pageUrl, sectionIndex, title, heldOn, municipalityId } = params;

  const html = await fetchPage(pageUrl);
  if (!html) {
    console.warn(`[itayanagi] detail page fetch failed: ${pageUrl}`);
    return null;
  }

  const statements = parseDetailSection(html, sectionIndex);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: pageUrl,
    externalId: `itayanagi_${pageUrl.split("/").pop()}_${sectionIndex}`,
    statements,
  };
}
