import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type MeetingData,
  type ScraperAdapter,
  SharedSystemAdapterKey,
} from "@open-gikai/scrapers";
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

    expect(result.meetings).toEqual([]);
    expect(result.truncated).toBe(false);
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

    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0]).toBe(meeting);
    expect(result.truncated).toBe(false);
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

    expect(result.meetings).toEqual([]);
    expect(result.truncated).toBe(false);
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

    expect(result.meetings).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(adapter.fetchDetail).toHaveBeenCalledTimes(2);
  });

  it("meetingLimit が全件数以上なら truncated は false", async () => {
    const records = Array.from({ length: 3 }, (_, i) => ({
      detailParams: { id: String(i) },
    }));
    const adapter: ScraperAdapter = {
      name: "test-adapter",
      fetchList: vi.fn().mockResolvedValue(records),
      fetchDetail: vi.fn().mockResolvedValue(createMeetingData()),
    };

    const result = await scrapeOneYear(
      adapter, "011002", "テスト市", "https://example.com", 2024, 5,
    );

    expect(result.meetings).toHaveLength(3);
    expect(result.truncated).toBe(false);
  });

  it("getDetailConcurrency(adapter.name) の上限で同時実行数が制御される", async () => {
    let current = 0;
    let maxConcurrent = 0;

    const records = Array.from({ length: 10 }, (_, i) => ({
      detailParams: { id: String(i) },
    }));
    const adapter: ScraperAdapter = {
      // dbsearch は getDetailConcurrency で 2（共有システム用の控えめな値）
      name: SharedSystemAdapterKey.DBSEARCH,
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
      adapter,
      "011002",
      "テスト市",
      "https://example.com",
      2024,
    );

    expect(result.meetings).toHaveLength(10);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
