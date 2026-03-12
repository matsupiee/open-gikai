# DiscussNet Scraper Implementation Guide

**Version:** 1.0
**Target:** Phase 2 of scraper-worker development
**Status:** Ready for implementation

---

## Overview

This guide provides step-by-step implementation instructions for building a DiscussNet scraper adapter. The implementation follows the existing pattern used for NDL and Kagoshima scrapers in this project.

---

## 1. File Structure

Create the following files in `apps/scraper-worker/src/`:

```
apps/scraper-worker/src/
├── scrapers/
│   └── discussnet.ts           # DiscussNet HTML parser
├── handlers/
│   └── discussnet.ts           # Queue consumer + pagination
├── db/
│   └── process-meetings.ts     # (existing) - will be reused
└── utils/
    └── types.ts                # (update) - add DiscussNet message types
```

---

## 2. Phase 2a: Core Parser (`scrapers/discussnet.ts`)

This module parses DiscussNet HTML pages and extracts meeting data.

### 2.1 Type Definitions

```typescript
// apps/scraper-worker/src/scrapers/discussnet.ts

export interface DiscussNetMeetingInfo {
  /** Unique meeting identifier from KAIGI_KEY parameter */
  meetingKey: string;
  /** Display title (e.g., "令和6年3月定例会") */
  title: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Meeting type: "plenary", "committee", or "other" */
  type: "plenary" | "committee" | "other";
  /** Direct URL to detail page */
  detailUrl: string;
}

export interface DiscussNetMeetingData {
  title: string;
  heldOn: string; // YYYY-MM-DD
  meetingType: "plenary" | "committee" | "other";
  rawText: string;
}
```

### 2.2 HTML Fetching with Error Handling

```typescript
async function fetchHtml(url: string, maxRetries = 2): Promise<string | null> {
  const USER_AGENT = "open-gikai/1.0 (Municipal Council Record Aggregator)";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return null;
      }

      return await response.text();
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  return null;
}
```

### 2.3 Meeting List Parsing

```typescript
/**
 * Extract meeting links from a DiscussNet list page
 *
 * Expected HTML structure:
 * <table class="kaigiroku-list">
 *   <tbody>
 *     <tr>
 *       <td><a href="g07_kaigiroku.asp?KAIGI_KEY=12345">議会名</a></td>
 *       <td>2024年3月15日</td>
 *       <td>本会議</td>
 *     </tr>
 *   </tbody>
 * </table>
 */
export function extractMeetingLinks(
  html: string,
  baseUrl: string
): DiscussNetMeetingInfo[] {
  const $ = load(html);
  const meetings: DiscussNetMeetingInfo[] = [];

  // Common selectors - adjust based on actual HTML inspection
  const selectors = {
    row: "table.kaigiroku-list tbody tr, div.kaigiroku-list .kaigiroku-row",
    titleCell: "td:nth-child(1), td.kaigiroku-title",
    dateCell: "td:nth-child(2), td.kaigiroku-date",
    typeCell: "td:nth-child(3), td.kaigiroku-type",
  };

  $(selectors.row).each((_index, element) => {
    const $row = $(element);

    // Extract title and KAIGI_KEY from link
    const $link = $row.find("a[href*='KAIGI_KEY']").first();
    if ($link.length === 0) return;

    const href = $link.attr("href") || "";
    const keyMatch = href.match(/KAIGI_KEY=([^&]+)/);
    if (!keyMatch?.[1]) return;

    const meetingKey = keyMatch[1];
    const title = $link.text().trim();
    const dateText = $row.find(selectors.dateCell).text().trim();
    const typeText = $row.find(selectors.typeCell).text().trim();

    // Parse date
    const date = parseDiscussNetDate(dateText);
    if (!date) return;

    // Classify meeting type
    const type = classifyMeetingType(typeText);

    // Build absolute URL
    const detailUrl = new URL(`g07_kaigiroku.asp?KAIGI_KEY=${meetingKey}`, baseUrl).toString();

    meetings.push({
      meetingKey,
      title,
      date,
      type,
      detailUrl,
    });
  });

  return meetings;
}
```

### 2.4 Date Parsing

```typescript
/**
 * Parse Japanese date format to ISO string
 *
 * Supports:
 * - "2024年3月15日"
 * - "令和6年3月15日"
 * - "平成31年3月15日"
 * - "3月15日" (assume current/previous year)
 */
function parseDiscussNetDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr
    .replace(/[年月日]/g, "-")
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .trim();

  // Try Japanese era year first
  let year: number | null = null;
  const reiwaMatch = dateStr.match(/令和\s*(\d+)年/);
  if (reiwaMatch?.[1]) {
    year = 2018 + parseInt(reiwaMatch[1], 10);
  }

  const heisei = dateStr.match(/平成\s*(\d+)年/);
  if (heisei?.[1]) {
    year = 1988 + parseInt(heisei[1], 10);
  }

  // Fall back to Western year
  if (!year) {
    const westernMatch = dateStr.match(/(\d{4})年/);
    if (westernMatch?.[1]) {
      year = parseInt(westernMatch[1], 10);
    }
  }

  // Extract month and day
  const mdMatch = cleaned.match(/(\d{1,2})-(\d{1,2})/);
  if (!mdMatch?.[1] || !mdMatch[2]) {
    // Try original string
    const origMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
    if (!origMatch?.[1] || !origMatch[2]) return null;

    const month = origMatch[1].padStart(2, "0");
    const day = origMatch[2].padStart(2, "0");

    if (!year) {
      // No year found - use current year as fallback
      year = new Date().getFullYear();
    }

    return `${year}-${month}-${day}`;
  }

  if (!year) {
    year = new Date().getFullYear();
  }

  const month = mdMatch[1].padStart(2, "0");
  const day = mdMatch[2].padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Classify meeting type from Japanese text
 *
 * - "本会議" → "plenary"
 * - "委員会" → "committee"
 * - Other → "other"
 */
function classifyMeetingType(typeText: string): "plenary" | "committee" | "other" {
  const text = typeText.toLowerCase();
  if (text.includes("委員会")) return "committee";
  if (text.includes("本会議")) return "plenary";
  if (text.includes("臨時会")) return "plenary";
  if (text.includes("定例会")) return "plenary";
  return "other";
}
```

### 2.5 Meeting Detail Parsing

```typescript
/**
 * Extract full meeting content from detail page
 *
 * Handles:
 * - Multiple sessions (午前の部, 午後の部)
 * - Speaker identification (○, △, □ prefixes)
 * - Text normalization (full-width spaces, entities)
 */
export function extractMeetingContent(
  html: string,
  meetingTitle: string,
  meetingDate: string
): DiscussNetMeetingData {
  const $ = load(html);

  // Extract title if not provided
  let title = meetingTitle;
  const pageTitle = $("h1").first().text().trim();
  if (pageTitle && !title) {
    title = pageTitle;
  }

  // Extract all speech content
  const allText: string[] = [];

  // Strategy 1: Try to find main content container
  let $content = $(".kaigiroku-body").first();
  if ($content.length === 0) {
    $content = $("main").first();
  }
  if ($content.length === 0) {
    $content = $("#main").first();
  }
  if ($content.length === 0) {
    $content = $("body");
  }

  // Extract text while preserving speaker structure
  $content.find(".speech-item, .genpon, table.speech-table tr").each((_i, elem) => {
    const $elem = $(elem);

    // Handle different formats
    let line = "";

    const $speaker = $elem.find(".speaker, .genpon-name, td:first-child").first();
    const $content = $elem.find(".speech-content, .genpon-content, td:last-child").first();

    if ($speaker.length > 0) {
      const speakerText = $speaker.text().trim();
      const contentText = $content.length > 0 ? $content.text().trim() : "";

      if (speakerText && contentText) {
        line = `${speakerText} ${contentText}`;
      } else if (speakerText) {
        line = speakerText;
      } else if (contentText) {
        line = contentText;
      }
    } else {
      // Fallback: just get text
      line = $elem.text().trim();
    }

    if (line) {
      allText.push(line);
    }
  });

  // If no structured data found, try to get all text from main area
  if (allText.length === 0) {
    const bodyText = $content.text().trim();
    if (bodyText) {
      allText.push(bodyText);
    }
  }

  // Normalize and clean text
  let rawText = allText.join("\n\n");
  rawText = normalizeText(rawText);

  return {
    title: title || "Unknown Meeting",
    heldOn: meetingDate,
    meetingType: "plenary", // Will be overridden by caller
    rawText,
  };
}

/**
 * Normalize Japanese text
 *
 * - Full-width spaces → regular spaces
 * - Full-width numbers → ASCII numbers
 * - HTML entities → characters
 * - Multiple spaces → single space
 * - Multiple newlines → double newline
 */
function normalizeText(text: string): string {
  return text
    // Decode HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    // Full-width space to regular space
    .replace(/[　]/g, " ")
    // Full-width numbers to ASCII
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    // Collapse multiple spaces
    .replace(/  +/g, " ")
    // Normalize newlines
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Collapse multiple newlines to double
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

### 2.6 Pagination Detection

```typescript
/**
 * Detect next page URL from list page
 *
 * DiscussNet typically uses:
 * - Query param: ?page=2
 * - Link text: "次へ", "次ページ", ">>>"
 */
export function detectNextPage(
  html: string,
  currentUrl: string
): string | null {
  const $ = load(html);

  // Look for pagination links
  const nextSelectors = [
    'a.next[href]',
    'a[title*="次"]',
    'a:contains("次へ")',
    'a:contains("次ページ")',
    'a:contains(">>>")',
    '.pagination a:last-child',
  ];

  for (const selector of nextSelectors) {
    const $link = $(selector).first();
    if ($link.length > 0) {
      const href = $link.attr("href");
      if (href) {
        try {
          return new URL(href, currentUrl).toString();
        } catch {
          // Invalid URL, skip
        }
      }
    }
  }

  // Try to increment page parameter
  const url = new URL(currentUrl);
  const page = url.searchParams.get("page");
  if (page) {
    const nextPage = parseInt(page, 10) + 1;
    url.searchParams.set("page", nextPage.toString());
    return url.toString();
  }

  return null;
}
```

---

## 3. Phase 2b: Queue Handler (`handlers/discussnet.ts`)

This module consumes queue messages and orchestrates the scraping process.

### 3.1 Complete Handler Implementation

```typescript
// apps/scraper-worker/src/handlers/discussnet.ts

import { eq } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { delay, randomDelay } from "../utils/delay";
import {
  addJobStats,
  createScraperJobLog,
  updateScraperJobStatus,
} from "../db/job-logger";
import type { ScraperQueueMessage } from "../utils/types";
import { saveMeetings } from "../db/save-meetings";
import {
  extractMeetingLinks,
  extractMeetingContent,
  detectNextPage,
} from "../scrapers/discussnet";

/** Configuration constants */
const DELAY_MS = 1500; // Polite request delay
const USER_AGENT =
  "open-gikai/1.0 (Municipal Council Record Aggregator; contact: your-email@example.com)";

type DiscussNetMunicipalityMsg = Extract<
  ScraperQueueMessage,
  { type: "discussnet-municipality" }
>;

type DiscussNetMeetingMsg = Extract<
  ScraperQueueMessage,
  { type: "discussnet-meeting" }
>;

/**
 * Handler for 'discussnet-municipality' queue messages
 *
 * Fetches the meeting list page, extracts individual meeting URLs,
 * and enqueues them as 'discussnet-meeting' messages for processing.
 */
export async function handleDiscussNetMunicipality(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: DiscussNetMunicipalityMsg
): Promise<void> {
  const { jobId, municipalityId, baseUrl, page = 1 } = msg;

  // Check if job is cancelled
  const jobRows = await db
    .select({ status: scraper_jobs.status })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);

  if (jobRows[0]?.status === "cancelled") {
    await createScraperJobLog(db, {
      jobId,
      level: "info",
      message: `DiscussNet: ${municipalityId} ジョブがキャンセルされました`,
    });
    return;
  }

  const listUrl = new URL(baseUrl);
  if (page > 1) {
    listUrl.searchParams.set("page", page.toString());
  }

  await createScraperJobLog(db, {
    jobId,
    level: "info",
    message: `DiscussNet: ${municipalityId} リスト取得中 (ページ ${page})`,
  });

  // Polite delay
  await randomDelay(DELAY_MS - 500, DELAY_MS + 500);

  // Fetch list page
  const html = await fetchHtmlPolitely(listUrl.toString());
  if (!html) {
    await createScraperJobLog(db, {
      jobId,
      level: "warn",
      message: `DiscussNet: ${municipalityId} リストページの取得に失敗しました (ページ ${page})`,
    });
    return;
  }

  // Extract meeting links
  const meetings = extractMeetingLinks(html, baseUrl);
  if (meetings.length === 0) {
    await createScraperJobLog(db, {
      jobId,
      level: "warn",
      message: `DiscussNet: ${municipalityId} 議事録が見つかりません (ページ ${page})`,
    });

    // If first page and no results, mark as done
    if (page === 1) {
      await createScraperJobLog(db, {
        jobId,
        level: "info",
        message: `DiscussNet: ${municipalityId} 完了`,
      });
    }
    return;
  }

  await createScraperJobLog(db, {
    jobId,
    level: "info",
    message: `DiscussNet: ${municipalityId} ${meetings.length} 件の議事録を検出 (ページ ${page})`,
  });

  // Enqueue individual meeting URLs
  for (const meeting of meetings) {
    await queue.send({
      type: "discussnet-meeting",
      jobId,
      municipalityId,
      meetingUrl: meeting.detailUrl,
    });
  }

  // Check for next page
  const nextPageUrl = detectNextPage(html, listUrl.toString());
  if (nextPageUrl) {
    // Extract page number from next URL
    const nextUrl = new URL(nextPageUrl);
    const nextPage = parseInt(nextUrl.searchParams.get("page") || "2", 10);

    await queue.send({
      type: "discussnet-municipality",
      jobId,
      municipalityId,
      baseUrl,
      page: nextPage,
    });

    await createScraperJobLog(db, {
      jobId,
      level: "debug",
      message: `DiscussNet: ${municipalityId} 次ページキューに追加 (ページ ${nextPage})`,
    });
  }
}

/**
 * Handler for 'discussnet-meeting' queue messages
 *
 * Fetches individual meeting detail page and extracts content.
 */
export async function handleDiscussNetMeeting(
  db: Db,
  msg: DiscussNetMeetingMsg
): Promise<void> {
  const { jobId, municipalityId, meetingUrl } = msg;

  // Polite delay
  await randomDelay(DELAY_MS - 500, DELAY_MS + 500);

  // Fetch detail page
  const html = await fetchHtmlPolitely(meetingUrl);
  if (!html) {
    await createScraperJobLog(db, {
      jobId,
      level: "warn",
      message: `DiscussNet: ${municipalityId} 議事録詳細の取得に失敗 (${meetingUrl})`,
    });
    return;
  }

  // Extract meeting data
  let meetingData = extractMeetingContent(html, "", "");

  // If we have URL parameters, try to extract metadata
  const url = new URL(meetingUrl);
  const meetingKey = url.searchParams.get("KAIGI_KEY") || "unknown";

  // Extract meeting links again to get metadata
  // (This is a workaround if detail page doesn't have full info)
  const meetingTitle = extractPageTitle(html);
  const meetingDate = extractPageDate(html);

  // Determine meeting type from content or URL
  const meetingType = determineMeetingType(html, meetingData.title);

  // Generate external ID (avoid duplicates)
  const externalId = `discussnet_${municipalityId}_${meetingKey}`;

  // Prepare meeting record for database
  const record = {
    title: meetingTitle || meetingData.title,
    meetingType,
    heldOn: meetingDate || meetingData.heldOn,
    sourceUrl: meetingUrl,
    assemblyLevel: "municipal" as const,
    prefecture: null, // Will be filled from municipalities table later
    municipality: null, // Will be filled from municipalities table later
    externalId,
    rawText: meetingData.rawText,
  };

  // Save to database
  const { inserted, skipped } = await saveMeetings(db, [record]);

  if (inserted > 0) {
    await createScraperJobLog(db, {
      jobId,
      level: "debug",
      message: `DiscussNet: ${municipalityId} 議事録を保存 (${record.title})`,
    });
  } else if (skipped > 0) {
    await createScraperJobLog(db, {
      jobId,
      level: "debug",
      message: `DiscussNet: ${municipalityId} 重複 (${record.title})`,
    });
  }

  // Update job statistics
  await addJobStats(db, jobId, inserted, skipped);
}

/**
 * Polite fetch with User-Agent and retry logic
 */
async function fetchHtmlPolitely(
  url: string,
  maxRetries = 2
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (response.ok) {
        return await response.text();
      }

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return null;
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  return null;
}

/**
 * Extract main title from page (h1 tag)
 */
function extractPageTitle(html: string): string | null {
  const $ = load(html);
  const title = $("h1").first().text().trim();
  return title || null;
}

/**
 * Extract date from page metadata or content
 */
function extractPageDate(html: string): string | null {
  // Try meta tags first
  const $ = load(html);
  const meta = $('meta[property="article:published_time"]').attr("content");
  if (meta) {
    return meta.split("T")[0]; // ISO date
  }

  // Try to find date in content
  const dateMatch = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  }

  return null;
}

/**
 * Determine meeting type from page content
 */
function determineMeetingType(
  html: string,
  title: string
): "plenary" | "committee" | "other" {
  const searchText = (html + title).toLowerCase();
  if (searchText.includes("委員会")) return "committee";
  if (searchText.includes("本会議")) return "plenary";
  if (searchText.includes("臨時会")) return "plenary";
  return "plenary"; // Default assumption
}
```

---

## 4. Queue Message Type Updates

### 4.1 Update `utils/types.ts`

Add to the `ScraperQueueMessage` union type:

```typescript
// apps/scraper-worker/src/utils/types.ts

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
      typeGroupNames: string[];
      remainingCouncils: number;
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
    }
  | {
      // NEW: DiscussNet municipality list page
      type: "discussnet-municipality";
      jobId: string;
      municipalityId: string;
      baseUrl: string; // Base URL for the municipality (e.g., https://takayama.discussnet.jp/)
      page?: number; // Page number for pagination (default: 1)
    }
  | {
      // NEW: DiscussNet individual meeting detail page
      type: "discussnet-meeting";
      jobId: string;
      municipalityId: string;
      meetingUrl: string; // Full URL to meeting detail page
    };
```

---

## 5. Integration with `handlers/start-job.ts`

### 5.1 Add DiscussNet Case

```typescript
// In apps/scraper-worker/src/handlers/start-job.ts

// After the kagoshima case, add:

case "discussnet": {
  // Get municipalities from the municipalities table
  // This assumes the municipalities table is set up with DiscussNet entries
  // For now, use a hardcoded list for testing

  const testMunicipalities = [
    {
      id: "takayama",
      name: "Takayama",
      baseUrl: "https://takayama.discussnet.jp/g07_kaigirokuichiran.asp",
    },
    {
      id: "isseljapan",
      name: "Issel",
      baseUrl: "https://isseljapan.discussnet.jp/g07_kaigirokuichiran.asp",
    },
    // Add more test municipalities here
  ];

  await createScraperJobLog(db, {
    jobId,
    level: "info",
    message: `DiscussNet: ${testMunicipalities.length} 自治体をキューに追加`,
  });

  for (const municipality of testMunicipalities) {
    await env.SCRAPER_QUEUE.send({
      type: "discussnet-municipality",
      jobId,
      municipalityId: municipality.id,
      baseUrl: municipality.baseUrl,
      page: 1,
    });
  }

  await updateScraperJobStatus(db, jobId, "running", {
    totalItems: testMunicipalities.length,
    processedItems: 0,
  });

  break;
}
```

---

## 6. Testing Checklist

### 6.1 Unit Tests

```typescript
// apps/scraper-worker/src/scrapers/__tests__/discussnet.test.ts

import { describe, it, expect } from "bun:test";
import {
  extractMeetingLinks,
  extractMeetingContent,
  detectNextPage,
} from "../discussnet";

describe("DiscussNet Parser", () => {
  it("should parse meeting list from HTML", () => {
    const html = `
      <table class="kaigiroku-list">
        <tbody>
          <tr>
            <td><a href="g07_kaigiroku.asp?KAIGI_KEY=12345">令和6年3月定例会 本会議</a></td>
            <td>2024年3月15日</td>
            <td>本会議</td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = extractMeetingLinks(html, "https://takayama.discussnet.jp/");
    expect(meetings).toHaveLength(1);
    expect(meetings[0].meetingKey).toBe("12345");
    expect(meetings[0].date).toBe("2024-03-15");
  });

  it("should extract meeting content", () => {
    const html = `
      <div class="kaigiroku-body">
        <div class="speech-item">
          <span class="speaker">○田中太郎議員：</span>
          <span class="speech-content">ご質問ありがとうございます。</span>
        </div>
      </div>
    `;

    const data = extractMeetingContent(html, "Test Meeting", "2024-03-15");
    expect(data.rawText).toContain("田中太郎議員");
    expect(data.rawText).toContain("ご質問ありがとうございます");
  });

  it("should parse Japanese dates correctly", () => {
    const html = `
      <div>
        <table class="kaigiroku-list">
          <tbody>
            <tr>
              <td><a href="g07_kaigiroku.asp?KAIGI_KEY=1">Test</a></td>
              <td>令和6年3月15日</td>
              <td>本会議</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const meetings = extractMeetingLinks(html, "https://test.discussnet.jp/");
    expect(meetings[0].date).toBe("2024-03-15");
  });

  it("should detect next page link", () => {
    const html = `
      <div class="pagination">
        <a href="?page=2">次へ</a>
      </div>
    `;

    const next = detectNextPage(html, "https://takayama.discussnet.jp/g07_kaigirokuichiran.asp?page=1");
    expect(next).toContain("page=2");
  });
});
```

### 6.2 Manual Testing with Local Runner

```typescript
// Create apps/scraper-worker/src/test-discussnet.ts for local testing

import { localRunner } from "./utils/local-runner";

async function testDiscussNetScraper() {
  const testMunicipalities = [
    {
      id: "takayama",
      baseUrl: "https://takayama.discussnet.jp/g07_kaigirokuichiran.asp",
    },
  ];

  // Run with local runner to test
  await localRunner({
    source: "discussnet",
    municipalityId: "takayama",
    baseUrl: "https://takayama.discussnet.jp/g07_kaigirokuichiran.asp",
  });
}

testDiscussNetScraper().catch(console.error);
```

### 6.3 End-to-End Testing Steps

1. **Setup:**
   - Create a test DiscussNet municipality entry
   - Clear any existing test data from DB

2. **Trigger job:**
   ```bash
   curl -X POST http://localhost:8787/api/scraper-job \
     -H "Content-Type: application/json" \
     -d '{"source": "discussnet"}'
   ```

3. **Monitor logs:**
   - Check job logs for any errors
   - Verify meetings are being inserted to DB
   - Count total records inserted

4. **Validate data:**
   ```sql
   SELECT COUNT(*) FROM meetings WHERE source = 'discussnet';
   SELECT * FROM meetings WHERE source = 'discussnet' LIMIT 5;
   ```

---

## 7. Troubleshooting

### Problem: "403 Forbidden" on some sites

**Cause:** User-Agent rejection or IP-based blocking

**Solution:**
- Add a realistic User-Agent header
- Increase delay between requests to 3-5 seconds
- Check if `robots.txt` disallows `/g07_` paths

### Problem: Dates parsing as wrong year

**Cause:** Japanese year format not recognized

**Solution:**
- Check if date uses 令和 (Reiwa), 平成 (Heisei), or 昭和 (Showa)
- Update `parseDiscussNetDate()` to handle that era
- Verify year conversion math (令和 6 = 2024, not 2006)

### Problem: No meetings extracted from list page

**Cause:** HTML selectors don't match actual structure

**Solution:**
- Fetch raw HTML and inspect with browser DevTools
- Find actual CSS classes used (may vary by DiscussNet instance)
- Update selectors in `extractMeetingLinks()`
- Add logging to show what selectors matched

### Problem: Queue messages not being consumed

**Cause:** Message type not registered in handler

**Solution:**
- Verify `ScraperQueueMessage` type includes `discussnet-municipality` and `discussnet-meeting`
- Ensure `main.ts` or `index.ts` imports and calls handlers
- Check CloudFlare Queues configuration in `wrangler.toml`

---

## 8. Performance Optimization

### Rate Limiting Strategy

```typescript
// Current: 1.5 seconds between requests
const DELAY_MS = 1500;

// For faster scraping on approved systems:
const DELAY_MS = 500;

// For conservative scraping to avoid blocking:
const DELAY_MS = 3000;
```

### Concurrent Processing

- DiscussNet handler queues individual meetings asynchronously
- Use CloudFlare Queue `max_concurrent_handlers` to limit parallel workers
- Recommended: 2-5 concurrent handlers per municipality

### Batch Operations

- Process multiple municipalities in parallel (different servers = different rate limits)
- Sequential processing within a municipality (same server = same rate limit)

---

## 9. Next Steps (Phase 3+)

After DiscussNet Phase 2 is complete:

1. **Municipalities table integration** (Phase 1)
   - Create `packages/db/src/schema/municipalities.ts`
   - Query municipalities from DB instead of hardcoded list

2. **DB-Search adapter** (Phase 3)
   - HTML structure is similar to DiscussNet
   - May reuse ~70% of parser code
   - Different domain patterns and selectors

3. **Monitoring & alerts**
   - Track error rates per municipality
   - Alert if a municipality goes offline
   - Dashboard for scraper health

---

## 10. Reference Links

- **Project Design Doc:** `/docs/地方自治体議会スクレイピング設計書.md`
- **Research Document:** `/docs/DiscussNet-scraper-research.md`
- **Existing NDL Scraper:** `/apps/scraper-worker/src/handlers/ndl.ts`
- **Existing Kagoshima Scraper:** `/apps/scraper-worker/src/handlers/kagoshima.ts`
- **Test Local Runner:** `/apps/scraper-worker/src/utils/local-runner.ts`

---

**Status:** Ready for implementation
**Estimated effort:** 1-2 weeks (development + testing)
**Next step:** Validate HTML selectors on 5 real DiscussNet sites before implementing parser
