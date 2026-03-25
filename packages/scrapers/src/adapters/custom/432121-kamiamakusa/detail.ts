/**
 * 上天草市議会 — detail フェーズ
 *
 * 詳細ページから PDF リンクを収集し、各 PDF をダウンロード・テキスト抽出して
 * ○ マーカーで発言を分割し MeetingData を組み立てる。
 *
 * 発言フォーマット（PDF テキスト）:
 *   ○議長（田端雅樹君） ただいまから…
 *   ○市長（松本啓太郎君） 皆さん、おはようございます。
 *   ○○番（氏名君） 質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, detectMeetingType, parseWarekiYear, delay } from "./shared";
import { parsePdfLinks } from "./list";

export interface KamiamakusaDetailParams {
  /** 詳細ページ ID */
  id: string;
  /** 会議タイトル */
  title: string;
  /** 掲載日 YYYY-MM-DD */
  postedOn: string;
  /** 詳細ページ URL */
  detailUrl: string;
}

const INTER_REQUEST_DELAY_MS = 1_500;

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "副教育長",
  "教育長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（田端雅樹君）       → role=議長, name=田端雅樹
 *   ○市長（松本啓太郎君）     → role=市長, name=松本啓太郎
 *   ○総務常任委員長（氏名君） → role=委員長, name=氏名
 *   ○○番（氏名君）           → role=議員, name=氏名
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（氏名君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
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

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    const normalized = trimmed.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  return statements;
}

/**
 * PDF URL からテキストを取得する。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[432121-kamiamakusa] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 詳細ページから MeetingData を組み立てる。
 * 複数 PDF がある場合はすべてのテキストを結合して発言を抽出する。
 */
export async function buildMeetingData(
  params: KamiamakusaDetailParams,
  municipalityCode: string,
  detailHtml: string,
): Promise<MeetingData | null> {
  const pdfUrls = parsePdfLinks(detailHtml);
  if (pdfUrls.length === 0) return null;

  // 会議開催日を和暦タイトルから推定
  // "平成28年第4回定例会(10月)議事録" → 月を取得
  const heldOn = extractHeldOn(params.title, params.postedOn);
  if (!heldOn) return null;

  const meetingType = detectMeetingType(params.title);

  // 複数 PDF を順に処理してテキストを結合
  const allStatements: ParsedStatement[] = [];
  let offsetBase = 0;

  for (let i = 0; i < pdfUrls.length; i++) {
    if (i > 0) await delay(INTER_REQUEST_DELAY_MS);

    const pdfUrl = pdfUrls[i]!;
    const text = await fetchPdfText(pdfUrl);
    if (!text) continue;

    const stmts = parseStatements(text);
    // offset を累積
    for (const s of stmts) {
      allStatements.push({
        ...s,
        startOffset: s.startOffset + offsetBase,
        endOffset: s.endOffset + offsetBase,
      });
    }
    if (stmts.length > 0) {
      const last = stmts[stmts.length - 1]!;
      offsetBase += last.endOffset + 1;
    }
  }

  if (allStatements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType,
    heldOn,
    sourceUrl: params.detailUrl,
    externalId: `kamiamakusa_${params.id}`,
    statements: allStatements,
  };
}

/**
 * タイトルと掲載日から開催日を推定する。
 * タイトルに "({月数}月)" のパターンがある場合はその月を使う。
 * 例: "平成28年第4回定例会(10月)議事録" → 平成28年 = 2016年、10月 → 2016-10-01
 * 月が推定できない場合は null を返す。
 */
export function extractHeldOn(title: string, _postedOn: string): string | null {
  // タイトルから和暦年と月を抽出
  const yearFromTitle = parseWarekiYear(title);

  // タイトルの "(XX月)" パターンから月を取得
  const monthMatch = title.match(/[（(](\d{1,2})月[）)]/);
  if (!monthMatch) {
    // 月が取得できない場合は掲載日の年月をフォールバックとして使用しない（null を返す）
    return null;
  }
  const month = parseInt(monthMatch[1]!, 10);

  if (yearFromTitle !== null) {
    return `${yearFromTitle}-${String(month).padStart(2, "0")}-01`;
  }

  // 和暦が取得できない場合は掲載日の年を使用しない（null を返す）
  return null;
}
