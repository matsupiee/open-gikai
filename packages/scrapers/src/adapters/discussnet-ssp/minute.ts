/**
 * DiscussNet SSP スクレイパー — minute フェーズ
 *
 * schedule_id ごとに議事録本文を取得し、MeetingData に変換する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../utils/types";
import { postJson, normalizeFullWidth, SSP_HOST } from "./shared";
import type { SspSchedule } from "./schedule";

interface MinuteItem {
  minute_id: number;
  title: string;
  body: string;
  minute_type: string;
  /** 2=名簿(メンバーリスト), 3=議題, 4=議長発言, 5=質問, 6=答弁, etc. */
  minute_type_code: number;
}

interface MinuteApiResponse {
  tenant_minutes: MinuteItem[];
}

/**
 * DiscussNet SSP の minute データ構造
 * 
 * {
    minute_id: 93,
    title: "議長（川越桂路君）",
    page_no: 340,
    hit_count: 0,
    body: "<pre>○議長（川越桂路君）　これをもって、令和４年第１
  回鹿児島市議会定例会を閉会いたします。\n　　　　　　　　　　
  　　　午前11時42分　閉会\n──────────────────────\n\n\n　　　
  　地方自治法第１２３条第２項の規定により署名する。\n\n\n　　
  　　　　　　　市議会議長　　川　　越　　桂　　路\n\n　　　　
  　　　　　市議会議員　　仮　　屋　　秀　　一\n\n　　　　　　
  　　　市議会議員　　伊 地 知　　紘　　徳\n</pre>",
    minute_anchor_id: "",
    minute_type: "○議長",
    minute_type_code: 4,
    speech_type: null,
    minute_link: [],
  }
 */

/**
 * 指定 schedule の議事録本文を取得し、MeetingData に変換して返す。
 * 本文が空の場合は null を返す。
 */
export async function fetchMinuteData(
  tenantId: number,
  tenantSlug: string,
  councilId: number,
  councilName: string,
  schedule: SspSchedule,
  municipalityCode: string,
  options?: { apiBase?: string; host?: string; viewYear?: string }
): Promise<MeetingData | null> {
  const data = await postJson<MinuteApiResponse>("minutes/get_minute", {
    tenant_id: tenantId,
    council_id: councilId,
    schedule_id: schedule.scheduleId,
  }, options?.apiBase);
  if (!data?.tenant_minutes) return null;

  const statements: ParsedStatement[] = [];
  let offset = 0;
  for (const m of data.tenant_minutes) {
    const kind = classifyKindByCode(m.minute_type_code);
    if (kind === null) continue;

    const { speakerName, speakerRole } = parseSpeakerFromTitle(m.title);

    const rawContent = extractTextFromBody(m.body);
    if (!rawContent) continue;

    const cleanedTitle = m.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const content = rawContent.replace(
      new RegExp(`^.{1}${cleanedTitle}\\s*`),
      ""
    );

    const contentHash = createHash("sha256")
      .update(`${m.minute_id}:${content}`)
      .digest("hex");

    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind,
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  const heldOn =
    extractDateFromMemberList(schedule.memberList) ??
    (options?.viewYear
      ? extractDateFromScheduleName(schedule.name, options.viewYear)
      : null);
  if (!heldOn) return null;

  const title = `${councilName} ${normalizeScheduleName(schedule.name)}`;
  const externalId = `discussnet_ssp_${tenantId}_${councilId}_${schedule.scheduleId}`;
  const sourceUrl = buildMinuteViewUrl(
    tenantSlug,
    councilId,
    schedule.scheduleId,
    options?.host
  );

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(councilName),
    heldOn,
    sourceUrl,
    externalId,
    statements,
  };
}

// --- 内部ユーティリティ ---

/** minute_type_code から kind を決定する */
/** @internal テスト用にexport */
export function classifyKindByCode(code: number): string | null {
  if (code === 4) return "remark"; // 議長発言
  if (code === 5) return "question"; // 質問
  if (code === 6) return "answer"; // 答弁

  return null;
}

/**
 * title フィールドから speakerName / speakerRole を抽出する。
 * DiscussNet SSP の title は "田中市長" / "山田委員" のような「氏名+役職」形式を想定。
 */
/** @internal テスト用にexport */
export function parseSpeakerFromTitle(title: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const normalized = title.trim();

  const m = normalized.match(
    /^\s*(?:([^（()]+?)（([^）]+?)）|（([^）]+?)）)\s*$/u
  );

  if (!m) return { speakerRole: null, speakerName: null };

  const speakerRole = m[1]?.trim() ?? null;
  const rawSpeakerName = m[2] ?? m[3] ?? null;
  const speakerName = rawSpeakerName?.trim().replace(/(君|議員)$/u, "") ?? null;

  return { speakerRole, speakerName };
}

/** @internal テスト用にexport */
export function extractTextFromBody(body: string): string {
  return body
    .replace(/<pre[^>]*>/gi, "")
    .replace(/<\/pre>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** 漢数字を算用数字に変換する */
function kanjiToNumber(str: string): number {
  const kanjiDigits: Record<string, number> = {
    〇: 0, 一: 1, 二: 2, 三: 3, 四: 4,
    五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };
  let result = 0;
  let current = 0;
  for (const ch of str) {
    if (ch === "十") {
      result += current === 0 ? 10 : current * 10;
      current = 0;
    } else if (ch in kanjiDigits) {
      current = kanjiDigits[ch]!;
    }
  }
  return result + current;
}

/** @internal テスト用にexport */
export function extractDateFromMemberList(memberList: string): string | null {
  const text = normalizeFullWidth(
    memberList.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ")
  );

  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  // 1. 「年号+年+月+日」が連続（間にスペースあり可）している形式（最も精度が高い）
  for (const [era, base] of Object.entries(wareki)) {
    const m = text.match(new RegExp(`${era}\\s*(\\d+)年\\s*(\\d{1,2})月\\s*(\\d{1,2})日`));
    if (m?.[1] && m[2] && m[3]) {
      const y = base + Number(m[1]);
      return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
  }

  // 2. 「YYYY年(令和X年)MM月DD日」形式（西暦先行、括弧内に和暦）— 福山市等
  const westernFirst = text.match(/(\d{4})年\s*[（(][^）)]+[）)]\s*(\d{1,2})月(\d{1,2})日/);
  if (westernFirst?.[1] && westernFirst[2] && westernFirst[3]) {
    return `${westernFirst[1]}-${westernFirst[2].padStart(2, "0")}-${westernFirst[3].padStart(2, "0")}`;
  }

  // 3. 「令和X年（YYYY年）MM月DD日」形式（和暦先行、括弧内に西暦）— 越谷市等
  const parenM = text.match(/[（(](\d{4})年[）)]\s*(\d{1,2})月(\d{1,2})日/);
  if (parenM?.[1] && parenM[2] && parenM[3]) {
    return `${parenM[1]}-${parenM[2].padStart(2, "0")}-${parenM[3].padStart(2, "0")}`;
  }

  // 4. 漢数字の日付形式（「令和七年二月十九日」）— 山形県、天理市等
  for (const [era, base] of Object.entries(wareki)) {
    const m = text.match(new RegExp(`${era}([〇一二三四五六七八九十]+)年([〇一二三四五六七八九十]+)月([〇一二三四五六七八九十]+)日`));
    if (m?.[1] && m[2] && m[3]) {
      const y = base + kanjiToNumber(m[1]);
      const month = kanjiToNumber(m[2]);
      const day = kanjiToNumber(m[3]);
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 5. 年と月日が別行に分かれている場合の二段階抽出 — 北見市、足利市等
  for (const [era, base] of Object.entries(wareki)) {
    const yearMatch = text.match(new RegExp(`${era}\\s*(\\d+)年`));
    if (yearMatch?.[1]) {
      const y = base + Number(yearMatch[1]);
      const dateMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
      if (dateMatch?.[1] && dateMatch[2]) {
        return `${y}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
      }
    }
  }

  // 6. 漢数字の月日のみ（年号+算用数字年は別箇所にある）— 大阪府等
  for (const [era, base] of Object.entries(wareki)) {
    const yearMatch = text.match(new RegExp(`${era}\\s*(\\d+)年`));
    if (yearMatch?.[1]) {
      const y = base + Number(yearMatch[1]);
      const kanjiDateMatch = text.match(/([〇一二三四五六七八九十]+)月([〇一二三四五六七八九十]+)日/);
      if (kanjiDateMatch?.[1] && kanjiDateMatch[2]) {
        const month = kanjiToNumber(kanjiDateMatch[1]);
        const day = kanjiToNumber(kanjiDateMatch[2]);
        return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // 7. 西暦の一般形式
  const m = text.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

/**
 * schedule.name から日付を抽出するフォールバック。
 * 帯広市等の「02月27日－01号」形式に対応。
 * viewYear（例: "2025"）が必要。
 */
/** @internal テスト用にexport */
export function extractDateFromScheduleName(
  scheduleName: string,
  viewYear: string
): string | null {
  const normalized = normalizeFullWidth(scheduleName);
  const m = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (m?.[1] && m[2]) {
    return `${viewYear}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function normalizeScheduleName(name: string): string {
  return normalizeFullWidth(name).trim();
}

/** @internal テスト用にexport */
export function detectMeetingType(councilName: string): string {
  if (councilName.includes("委員会")) return "committee";
  if (councilName.includes("臨時会")) return "extraordinary";
  return "plenary";
}

function buildMinuteViewUrl(
  tenantSlug: string,
  councilId: number,
  scheduleId: number,
  host?: string
): string {
  const baseHost = host ?? SSP_HOST;
  const url = new URL(`${baseHost}/tenant/${tenantSlug}/MinuteView.html`);
  url.searchParams.set("council_id", String(councilId));
  url.searchParams.set("schedule_id", String(scheduleId));
  return url.toString();
}
