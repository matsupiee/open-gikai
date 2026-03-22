import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  extractDateFromContent,
  extractStatementFromHuidPage,
  parseSidebarHuids,
  classifyKind,
  detectMeetingType,
  fetchMeetingDetail,
} from "./detail";

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

// --- extractDateFromContent 実データテスト ---

describe("extractDateFromContent with real fixtures", () => {
  test("standard: つくば市のヘッダーから 2024-12-26 を抽出", () => {
    const html = fixture("standard", "header.html");
    expect(extractDateFromContent(html)).toBe("2024-12-26");
  });

  test("self-hosted-voices: 鴨川市のヘッダーから 2024-11-29 を抽出", () => {
    const html = fixture("self-hosted-voices", "header.html");
    expect(extractDateFromContent(html)).toBe("2024-11-29");
  });

  test("asp: 八戸市のヘッダーから 2024-12-17 を抽出", () => {
    const html = fixture("asp", "header.html");
    expect(extractDateFromContent(html)).toBe("2024-12-17");
  });
});

// --- parseSidebarHuids 実データテスト ---

describe("parseSidebarHuids with real fixtures", () => {
  test("standard: つくば市のサイドバーから 14 件の HUID を抽出", () => {
    const html = fixture("standard", "sidebar.html");
    const huids = parseSidebarHuids(html);

    expect(huids).toHaveLength(14);
    expect(huids[0]).toBe("338564");
  });

  test("self-hosted-voices: 鴨川市のサイドバーから 48 件の HUID を抽出（名簿スキップ）", () => {
    const html = fixture("self-hosted-voices", "sidebar.html");
    const huids = parseSidebarHuids(html);

    expect(huids).toHaveLength(48);
    expect(huids[0]).toBe("104612");
  });

  test("asp: 八戸市のサイドバーから 41 件の HUID を抽出", () => {
    const html = fixture("asp", "sidebar.html");
    const huids = parseSidebarHuids(html);

    expect(huids).toHaveLength(41);
    expect(huids[0]).toBe("220280");
  });
});

// --- extractStatementFromHuidPage 実データテスト ---

describe("extractStatementFromHuidPage with real fixtures", () => {
  test("standard: つくば市の委員長発言を抽出", () => {
    const html = fixture("standard", "huid-page.html");
    const stmt = extractStatementFromHuidPage(html);

    expect(stmt).not.toBeNull();
    expect(stmt!.prefix).toBe("○");
    expect(stmt!.speakerName).toBe("塩田");
    expect(stmt!.speakerRole).toBe("委員長");
    expect(stmt!.content).toContain("おはようございます");
    expect(classifyKind(stmt!.speakerRole, stmt!.prefix)).toBe("remark");
  });

  test("self-hosted-voices: 鴨川市の議長発言を抽出", () => {
    const html = fixture("self-hosted-voices", "huid-page.html");
    const stmt = extractStatementFromHuidPage(html);

    expect(stmt).not.toBeNull();
    expect(stmt!.prefix).toBe("○");
    expect(stmt!.speakerName).toBe("川崎浩之");
    expect(stmt!.speakerRole).toBe("議長");
    expect(stmt!.content).toContain("おはようございます");
    expect(classifyKind(stmt!.speakerRole, stmt!.prefix)).toBe("remark");
  });

  test("asp: 八戸市の委員長発言を抽出", () => {
    const html = fixture("asp", "huid-page.html");
    const stmt = extractStatementFromHuidPage(html);

    expect(stmt).not.toBeNull();
    expect(stmt!.prefix).toBe("○");
    // 「○中村　委員長」は形式C でマッチし speakerRole="中村" になる
    expect(stmt!.speakerRole).toBe("中村");
    expect(stmt!.content).toContain("委員長");
  });
});

// --- detectMeetingType 実データテスト ---

describe("detectMeetingType with real fixture titles", () => {
  test("standard: 委員会タイトルは committee", () => {
    expect(
      detectMeetingType("令和 ６年１２月２６日議会運営委員会,12月26日-01号"),
    ).toBe("committee");
  });

  test("self-hosted-voices: 定例会タイトルは plenary", () => {
    expect(
      detectMeetingType("令和 ６年第 ４回定例会,11月29日-01号"),
    ).toBe("plenary");
  });

  test("asp: 協議会タイトルは plenary", () => {
    expect(
      detectMeetingType("令和 ６年１２月 民生環境協議会,12月17日-01号"),
    ).toBe("plenary");
  });
});

// --- fetchMeetingDetail 統合テスト ---

describe("fetchMeetingDetail integration", () => {
  afterEach(() => {
    mockFetchShiftJisPage.mockReset();
  });

  test("standard: つくば市の議事録を取得", async () => {
    const headerHtml = fixture("standard", "header.html");
    const sidebarHtml = fixture("standard", "sidebar.html");
    const huidPageHtml = fixture("standard", "huid-page.html");

    mockFetchShiftJisPage
      .mockResolvedValueOnce(headerHtml) // ACT=203 header
      .mockResolvedValueOnce(sidebarHtml) // ACT=202 sidebar
      .mockResolvedValue(huidPageHtml); // 14 HUID pages

    const result = await fetchMeetingDetail(
      "https://tsukuba.gijiroku.com/voices/g08v_search.asp",
      "2778",
      "test-municipality-id",
      "K_R06122614011",
      "令和 ６年１２月２６日議会運営委員会,12月26日-01号",
      "12月26日-01号",
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-12-26");
    expect(result!.meetingType).toBe("committee");
    expect(result!.externalId).toBe("gijiroku_K_R06122614011");
    expect(result!.municipalityId).toBe("test-municipality-id");
    expect(result!.statements.length).toBeGreaterThan(0);
    expect(result!.statements[0]!.speakerName).toBe("塩田");

    // offset の連続性を検証
    for (let i = 1; i < result!.statements.length; i++) {
      expect(result!.statements[i]!.startOffset).toBe(
        result!.statements[i - 1]!.endOffset + 1,
      );
    }
  });

  test("self-hosted-voices: 鴨川市の議事録を取得", async () => {
    const headerHtml = fixture("self-hosted-voices", "header.html");
    const sidebarHtml = fixture("self-hosted-voices", "sidebar.html");
    const huidPageHtml = fixture("self-hosted-voices", "huid-page.html");

    mockFetchShiftJisPage
      .mockResolvedValueOnce(headerHtml)
      .mockResolvedValueOnce(sidebarHtml)
      .mockResolvedValue(huidPageHtml);

    const result = await fetchMeetingDetail(
      "http://www.city.kamogawa.chiba.jp/VOICES/",
      "999",
      "test-municipality-id",
      "K_R06112900011",
      "令和 ６年第 ４回定例会,11月29日-01号",
      "11月29日-01号",
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-11-29");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.externalId).toBe("gijiroku_K_R06112900011");
    expect(result!.statements.length).toBeGreaterThan(0);
    expect(result!.statements[0]!.speakerName).toBe("川崎浩之");
    expect(result!.statements[0]!.speakerRole).toBe("議長");
  });

  test("asp: 八戸市の議事録を取得", async () => {
    const headerHtml = fixture("asp", "header.html");
    const sidebarHtml = fixture("asp", "sidebar.html");
    const huidPageHtml = fixture("asp", "huid-page.html");

    mockFetchShiftJisPage
      .mockResolvedValueOnce(headerHtml)
      .mockResolvedValueOnce(sidebarHtml)
      .mockResolvedValue(huidPageHtml);

    const result = await fetchMeetingDetail(
      "http://www2.city.hachinohe.aomori.jp/kaigiroku/voices/g07v_search.asp",
      "4285",
      "test-municipality-id",
      "k_R06121742011",
      "令和 ６年１２月 民生環境協議会,12月17日-01号",
      "12月17日-01号",
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-12-17");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.externalId).toBe("gijiroku_k_R06121742011");
    expect(result!.statements.length).toBeGreaterThan(0);

    // offset の連続性を検証
    for (let i = 1; i < result!.statements.length; i++) {
      expect(result!.statements[i]!.startOffset).toBe(
        result!.statements[i - 1]!.endOffset + 1,
      );
    }
  });
});
