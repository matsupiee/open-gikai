import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchMeetingList, parseListHtml } from "./list";

vi.mock("./fetch-page", () => ({
  fetchShiftJisPage: vi.fn(),
}));

import { fetchShiftJisPage } from "./fetch-page";

const mockFetchShiftJisPage = vi.mocked(fetchShiftJisPage);

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );

// --- parseListHtml 単体テスト（実データ） ---

describe("parseListHtml with real fixtures", () => {
  test("standard: つくば市の winopen リンクから 184 件抽出", () => {
    const html = fixture("standard", "search-result.html");
    const records = parseListHtml(html);

    expect(records).toHaveLength(184);
    expect(records[0]!.fino).toBe("2778");
    expect(records[0]!.kgno).toBe("1878");
    expect(records[0]!.unid).toBe("K_R06122614011");
    expect(records[0]!.dateLabel).toBe("12月26日-01号");
    expect(records[0]!.title).toContain("議会運営委員会");
    expect(records[0]!.title).toContain("12月26日-01号");
  });

  test("self-hosted-voices: 鴨川市の winopen リンクから 24 件抽出", () => {
    const html = fixture("self-hosted-voices", "search-result.html");
    const records = parseListHtml(html);

    expect(records).toHaveLength(24);
    expect(records[0]!.fino).toBe("999");
    expect(records[0]!.kgno).toBe("224");
    expect(records[0]!.unid).toBe("K_R06112900011");
    expect(records[0]!.dateLabel).toBe("11月29日-01号");
    expect(records[0]!.title).toContain("定例会");
  });

  test("asp: 八戸市の winopen リンクから 131 件抽出", () => {
    const html = fixture("asp", "search-result.html");
    const records = parseListHtml(html);

    expect(records).toHaveLength(131);
    expect(records[0]!.fino).toBe("4285");
    expect(records[0]!.kgno).toBe("2392");
    expect(records[0]!.unid).toBe("k_R06121742011");
    expect(records[0]!.dateLabel).toBe("12月17日-01号");
    expect(records[0]!.title).toContain("民生環境協議会");
  });

  test("standard: 目次エントリはスキップされる", () => {
    const html = fixture("standard", "search-result.html");
    const records = parseListHtml(html);

    for (const r of records) {
      expect(r.dateLabel).not.toContain("目次");
    }
  });

  test("self-hosted-voices: 目次エントリはスキップされる", () => {
    const html = fixture("self-hosted-voices", "search-result.html");
    const records = parseListHtml(html);

    for (const r of records) {
      expect(r.dateLabel).not.toContain("目次");
    }
  });
});

// --- fetchMeetingList 統合テスト ---

describe("fetchMeetingList integration", () => {
  afterEach(() => {
    mockFetchShiftJisPage.mockReset();
  });

  test("standard: つくば市の検索フローで一覧を取得", async () => {
    const searchHtml = fixture("standard", "search-result.html");
    mockFetchShiftJisPage.mockResolvedValueOnce(searchHtml);

    const records = await fetchMeetingList(
      "https://tsukuba.gijiroku.com/voices/g08v_search.asp",
      2024,
    );

    expect(records).not.toBeNull();
    expect(records!).toHaveLength(184);
    expect(records![0]!.fino).toBe("2778");
    expect(records![0]!.title).toContain("議会運営委員会");
  });

  test("self-hosted-voices: 鴨川市の検索フローで一覧を取得", async () => {
    const searchHtml = fixture("self-hosted-voices", "search-result.html");
    mockFetchShiftJisPage.mockResolvedValueOnce(searchHtml);

    const records = await fetchMeetingList(
      "http://www.city.kamogawa.chiba.jp/VOICES/",
      2024,
    );

    expect(records).not.toBeNull();
    expect(records!).toHaveLength(24);
    expect(records![0]!.fino).toBe("999");
    expect(records![0]!.unid).toBe("K_R06112900011");
  });

  test("asp: 八戸市の検索フローで一覧を取得", async () => {
    const searchHtml = fixture("asp", "search-result.html");
    mockFetchShiftJisPage.mockResolvedValueOnce(searchHtml);

    const records = await fetchMeetingList(
      "http://www2.city.hachinohe.aomori.jp/kaigiroku/voices/g07v_search.asp",
      2024,
    );

    expect(records).not.toBeNull();
    expect(records!).toHaveLength(131);
    expect(records![0]!.fino).toBe("4285");
  });
});
