/**
 * DiscussNet SSP スクレイパー — minute フェーズ
 *
 * schedule_id ごとに議事録本文を取得し、MeetingData に変換する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { postJson, normalizeFullWidth, SSP_HOST } from "../_shared";
import type { SspSchedule } from "../schedule/scraper";

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
 * 指定 schedule の議事録本文を取得し、MeetingData に変換して返す。
 * 本文が空の場合は null を返す。
 */
export async function fetchMinuteData(
  tenantId: number,
  tenantSlug: string,
  councilId: number,
  councilName: string,
  schedule: SspSchedule,
  municipalityId: string
): Promise<MeetingData | null> {
  const data = await postJson<MinuteApiResponse>("minutes/get_minute", {
    tenant_id: tenantId,
    council_id: councilId,
    schedule_id: schedule.scheduleId,
  });
  if (!data?.tenant_minutes) return null;

  const statements: ParsedStatement[] = [];
  let offset = 0;
  for (const m of data.tenant_minutes) {
    // 2=名簿、3=議題はスキップ（発言ではない）
    if (m.minute_type_code < 4) continue;
    const content = extractTextFromBody(m.body);
    if (!content) continue;

    const contentHash = createHash("sha256")
      .update(`${m.minute_id}:${content}`)
      .digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKindByCode(m.minute_type_code),
      ...parseSpeakerFromTitle(m.title),
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  const heldOn = extractDateFromMemberList(schedule.memberList);
  if (!heldOn) return null;

  const title = `${councilName} ${normalizeScheduleName(schedule.name)}`;
  const externalId = `discussnet_ssp_${tenantId}_${councilId}_${schedule.scheduleId}`;
  const sourceUrl = buildMinuteViewUrl(
    tenantSlug,
    councilId,
    schedule.scheduleId
  );

  return {
    municipalityId,
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
function classifyKindByCode(code: number): string {
  if (code === 4) return "remark"; // 議長発言
  if (code === 6) return "answer"; // 答弁
  return "question"; // 5=質問、その他
}

const ROLE_SUFFIXES = [
  "委員長",
  "副委員長",
  "副議長",
  "副市長",
  "副町長",
  "副村長",
  "副部長",
  "副課長",
  "市長室長",
  "議長",
  "市長",
  "町長",
  "村長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
];

/**
 * title フィールドから speakerName / speakerRole を抽出する。
 * DiscussNet SSP の title は "田中市長" / "山田委員" のような「氏名+役職」形式を想定。
 */
function parseSpeakerFromTitle(title: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const normalized = title.trim();
  for (const suffix of ROLE_SUFFIXES) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      return {
        speakerRole: suffix,
        speakerName: normalized.slice(0, -suffix.length),
      };
    }
    if (normalized === suffix) {
      return { speakerRole: suffix, speakerName: null };
    }
  }
  return { speakerRole: null, speakerName: normalized || null };
}

function extractTextFromBody(body: string): string {
  return body
    .replace(/<pre[^>]*>/gi, "")
    .replace(/<\/pre>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractDateFromMemberList(memberList: string): string | null {
  const text = normalizeFullWidth(
    memberList.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ")
  );

  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  for (const [era, base] of Object.entries(wareki)) {
    const m = text.match(new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`));
    if (m?.[1] && m[2] && m[3]) {
      const y = base + Number(m[1]);
      return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
  }

  const m = text.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

function normalizeScheduleName(name: string): string {
  return normalizeFullWidth(name).trim();
}

function detectMeetingType(councilName: string): string {
  if (councilName.includes("委員会")) return "committee";
  if (councilName.includes("臨時会")) return "extraordinary";
  return "plenary";
}

function buildMinuteViewUrl(
  tenantSlug: string,
  councilId: number,
  scheduleId: number
): string {
  const url = new URL(`${SSP_HOST}/tenant/${tenantSlug}/MinuteView.html`);
  url.searchParams.set("council_id", String(councilId));
  url.searchParams.set("schedule_id", String(scheduleId));
  return url.toString();
}
