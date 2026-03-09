import { load } from "cheerio";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { MeetingData } from "../types";

interface ScraperTarget {
  prefecture: string;
  municipality: string;
  assemblyLevel: "prefectural" | "municipal";
  baseUrl: string;
  listSelector: string;
  contentSelector: string;
  dateSelector: string;
  titleSelector?: string;
}

/**
 * Delay execution for specified milliseconds
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load scraper targets from JSON file
 */
function loadTargets(): ScraperTarget[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const targetsPath = join(__dirname, "../../scraper-targets.json");

  try {
    const content = readFileSync(targetsPath, "utf-8");
    return JSON.parse(content) as ScraperTarget[];
  } catch (error) {
    console.error("Failed to load scraper targets:", error);
    return [];
  }
}

/**
 * Filter targets based on options
 */
function filterTargets(
  targets: ScraperTarget[],
  options: { prefecture?: string; municipality?: string }
): ScraperTarget[] {
  return targets.filter((target) => {
    if (options.prefecture && target.prefecture !== options.prefecture) {
      return false;
    }
    if (options.municipality && target.municipality !== options.municipality) {
      return false;
    }
    return true;
  });
}

/**
 * Fetch and parse HTML content
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Extract meeting links from list page
 */
async function extractMeetingLinks(
  baseUrl: string,
  listSelector: string
): Promise<string[]> {
  const html = await fetchHtml(baseUrl);
  if (!html) {
    return [];
  }

  const $ = load(html);
  const links: string[] = [];

  $(listSelector).each((_index, element) => {
    const href = $(element).attr("href");
    if (href) {
      const absoluteUrl = new URL(href, baseUrl).toString();
      links.push(absoluteUrl);
    }
  });

  return links;
}

/**
 * Extract meeting data from content page
 */
async function extractMeetingData(
  url: string,
  target: ScraperTarget
): Promise<MeetingData | null> {
  const html = await fetchHtml(url);
  if (!html) {
    return null;
  }

  try {
    const $ = load(html);

    const title =
      $(target.titleSelector || "h1").first().text().trim() || "Unknown Title";
    const dateText = $(target.dateSelector).first().text().trim() || "";
    const content = $(target.contentSelector).html() || "";

    const heldOn = parseDateString(dateText);
    if (!heldOn) {
      console.error(`[LOCAL] Could not parse date: ${dateText}`);
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
  } catch (error) {
    console.error(`[LOCAL] Error extracting data from ${url}:`, error);
    return null;
  }
}

/**
 * Parse date string to YYYY-MM-DD format
 * Handles various Japanese date formats
 */
function parseDateString(dateStr: string): string | null {
  const cleaned = dateStr.replace(/[年月日]/g, "-").replace(/\s+/g, "");

  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(cleaned)) {
    const parts = cleaned.split("-");
    const year = parts[0].padStart(4, "0");
    const month = parts[1].padStart(2, "0");
    const day = parts[2].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const match = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Scrape meetings from local assembly websites.
 * Returns all fetched records as MeetingData array.
 */
export async function scrapeLocal(options: {
  prefecture?: string;
  municipality?: string;
  limit?: number; // max links per target (for testing)
}): Promise<MeetingData[]> {
  console.log(
    `\n[Local Scraper] Starting local assembly scrape with options:`,
    options
  );
  if (options.limit !== undefined) {
    console.log(`[Local Scraper] Limit: ${options.limit} links per target`);
  }

  const targets = loadTargets();
  const filteredTargets = filterTargets(targets, options);

  if (filteredTargets.length === 0) {
    console.log("[Local] No matching targets found");
    return [];
  }

  console.log(`[Local] Found ${filteredTargets.length} target(s) to scrape`);

  const results: MeetingData[] = [];

  for (const target of filteredTargets) {
    console.log(
      `[Local] Processing ${target.prefecture} ${target.municipality}`
    );

    try {
      // Extract meeting links from list page (apply limit if set)
      const allLinks = await extractMeetingLinks(target.baseUrl, target.listSelector);
      const links =
        options.limit !== undefined ? allLinks.slice(0, options.limit) : allLinks;
      console.log(
        `[Local] Found ${links.length} meeting link(s) for ${target.municipality}`
      );

      if (links.length === 0) {
        console.log(
          `[Local] No links found for ${target.municipality}, skipping`
        );
        continue;
      }

      for (const link of links) {
        const meeting = await extractMeetingData(link, target);
        if (meeting) {
          results.push(meeting);
        }

        // Delay between requests to avoid overwhelming the site
        await delay(1000);
      }

      console.log(`[Local] ${target.municipality}: fetched ${results.length} records so far`);
    } catch (error) {
      console.error(
        `[Local] Error processing ${target.municipality}:`,
        error
      );
    }

    // Delay between targets
    await delay(1000);
  }

  console.log(`[Local Scraper] Complete: Fetched ${results.length} total records`);
  return results;
}
