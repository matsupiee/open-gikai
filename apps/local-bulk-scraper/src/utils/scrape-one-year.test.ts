import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingData, ScraperAdapter } from "@open-gikai/scrapers";
import { scrapeOneYear } from "./scrape-one-year";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createMeetingData(overrides: Partial<MeetingData> = {}): MeetingData {
  return {
    municipalityCode: "011002",
    title: "令和6年第1回定例会",
    meetingType: "定例会",
    heldOn: "2024-03-01",
    sourceUrl: "https://example.com/meeting/1",
    externalId: "meeting-1",
    statements: [
      {
        kind: "発言",
        speakerName: "田中太郎",
        speakerRole: "議員",
        content: "テスト発言内容です。",
        contentHash: "abc123",
        startOffset: 0,
        endOffset: 100,
      },
    ],
    ...overrides,
  };
}

describe("scrapeOneYear", () => {
  it("fetchList が空配列を返したら空配列を返し fetchDetail は呼ばれない", async () => {
    const adapter: ScraperAdapter = {
      name: "test-adapter",
      fetchList: vi.fn().mockResolvedValue([]),
      fetchDetail: vi.fn(),
    };

    const result = await scrapeOneYear(adapter, "011002", "テスト市", "https://example.com", 2024);

    expect(result).toEqual([]);
    expect(adapter.fetchDetail).not.toHaveBeenCalled();
  });

  it("1件のレコードを取得して MeetingData を返す", async () => {
    const meeting = createMeetingData();
    const adapter: ScraperAdapter = {
      name: "test-adapter",
      fetchList: vi.fn().mockResolvedValue([
        { detailParams: { id: "1" } },
      ]),
      fetchDetail: vi.fn().mockResolvedValue(meeting),
    };

    const result = await scrapeOneYear(adapter, "011002", "テスト市", "https://example.com", 2024);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(meeting);
    expect(adapter.fetchDetail).toHaveBeenCalledWith({
      detailParams: { id: "1" },
      municipalityCode: "011002",
    });
  });

  it("fetchDetail が null を返したら結果に含まれない", async () => {
    const adapter: ScraperAdapter = {
      name: "test-adapter",
      fetchList: vi.fn().mockResolvedValue([
        { detailParams: { id: "1" } },
      ]),
      fetchDetail: vi.fn().mockResolvedValue(null),
    };

    const result = await scrapeOneYear(adapter, "011002", "テスト市", "https://example.com", 2024);

    expect(result).toEqual([]);
  });

  it("meetingLimit で取得件数を制限する", async () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      detailParams: { id: String(i) },
    }));
    const adapter: ScraperAdapter = {
      name: "test-adapter",
      fetchList: vi.fn().mockResolvedValue(records),
      fetchDetail: vi.fn().mockResolvedValue(createMeetingData()),
    };

    const result = await scrapeOneYear(
      adapter, "011002", "テスト市", "https://example.com", 2024, 2,
    );

    expect(result).toHaveLength(2);
    expect(adapter.fetchDetail).toHaveBeenCalledTimes(2);
  });

  it("detailConcurrency で同時実行数を制御する", async () => {
    let current = 0;
    let maxConcurrent = 0;

    const records = Array.from({ length: 10 }, (_, i) => ({
      detailParams: { id: String(i) },
    }));
    const adapter: ScraperAdapter = {
      name: "test-adapter",
      fetchList: vi.fn().mockResolvedValue(records),
      fetchDetail: vi.fn().mockImplementation(async () => {
        current++;
        if (current > maxConcurrent) maxConcurrent = current;
        await new Promise((r) => setTimeout(r, 10));
        current--;
        return createMeetingData();
      }),
    };

    const result = await scrapeOneYear(
      adapter, "011002", "テスト市", "https://example.com", 2024, undefined, 2,
    );

    expect(result).toHaveLength(10);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
