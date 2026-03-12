/**
 * ローカル自治体議会スクレイパー（HTML スクレイピング）
 *
 * targets は呼び出し元が設定として渡す（readFileSync は使用しない）。
 * CFW 互換: fetch + cheerio のみ使用。
 */

import { load } from "cheerio";
import type { Db } from "@open-gikai/db";
import type { MeetingData, LocalScraperTarget } from "../utils/types";

interface LocalScraperConfig {
  targets: LocalScraperTarget[];
  limit?: number;
}
import { delay } from "../utils/delay";
import { createScraperJobLog } from "../db/job-logger";
import type { LogLevel } from "@open-gikai/db/schema";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function extractMeetingLinks(
  baseUrl: string,
  listSelector: string
): Promise<string[]> {
  const html = await fetchHtml(baseUrl);
  if (!html) return [];

  const $ = load(html);
  const links: string[] = [];

  $(listSelector).each((_index, element) => {
    const href = $(element).attr("href");
    if (href) {
      links.push(new URL(href, baseUrl).toString());
    }
  });

  return links;
}

function parseDateString(dateStr: string): string | null {
  const cleaned = dateStr.replace(/[年月日]/g, "-").replace(/\s+/g, "");

  const match = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match?.[1] && match[2] && match[3]) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(
      2,
      "0"
    )}`;
  }

  return null;
}

async function extractMeetingData(
  url: string,
  target: LocalScraperTarget,
  logger: (level: LogLevel, message: string) => Promise<void>
): Promise<MeetingData | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  try {
    const $ = load(html);
    const title =
      $(target.titleSelector || "h1")
        .first()
        .text()
        .trim() || "Unknown Title";
    const dateText = $(target.dateSelector).first().text().trim();
    const content = $(target.contentSelector).html() || "";

    const heldOn = parseDateString(dateText);
    if (!heldOn) {
      await logger(
        "warn",
        `[Local] 日付を解析できません: "${dateText}" (${url})`
      );
      return null;
    }

    return {
      title,
      meetingType: "plenary",
      heldOn,
      sourceUrl: url,
      assemblyLevel: target.assemblyLevel,
      prefecture: target.prefecture,
      municipality: target.municipality,
      externalId: `local_${target.municipality}_${heldOn}`.replace(/\s+/g, "_"),
      rawText: content,
    };
  } catch {
    await logger("error", `[Local] データ抽出エラー: ${url}`);
    return null;
  }
}

/**
 * ローカル自治体議会の議事録を取得する。
 * targets は設定として渡す（ファイル読み込み不要）。
 * CFW 互換: fetch + cheerio のみ使用。
 */
export async function scrapeLocal(
  config: LocalScraperConfig,
  db: Db,
  jobId: string
): Promise<MeetingData[]> {
  const { targets, limit } = config;

  const logger = async (level: LogLevel, message: string) => {
    await createScraperJobLog(db, {
      jobId,
      level,
      message,
    });
  };

  await logger(
    "info",
    `Local scrape 開始: ${targets.length} ターゲット${
      limit ? ` (上限 ${limit} 件/target)` : ""
    }`
  );

  if (targets.length === 0) return [];

  const results: MeetingData[] = [];

  for (const target of targets) {
    try {
      const allLinks = await extractMeetingLinks(
        target.baseUrl,
        target.listSelector
      );
      const links = limit !== undefined ? allLinks.slice(0, limit) : allLinks;

      await logger(
        "info",
        `Local: ${target.municipality} — ${links.length} 件のリンクを検出`
      );

      if (links.length === 0) {
        await logger(
          "warn",
          `Local: ${target.municipality} — リンクが見つかりません`
        );
        continue;
      }

      for (const link of links) {
        const meeting = await extractMeetingData(link, target, logger);
        if (meeting) {
          results.push(meeting);
        }
        await delay(1000);
      }

      await logger(
        "info",
        `Local: ${target.municipality} 処理完了 (累計: ${results.length} 件)`
      );
    } catch (err) {
      await logger(
        "error",
        `Local: ${target.municipality} でエラーが発生しました — ${String(err)}`
      );
    }

    await delay(1000);
  }

  await logger("info", `Local scrape 完了: 合計 ${results.length} 件`);
  return results;
}
