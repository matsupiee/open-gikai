import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  fetchMeetingDetail,
  extractTitle,
  extractDate,
  extractStatements,
} from "./detail";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );

// --- パース関数の実データテスト ---

describe("extractTitle with real fixtures", () => {
  test("template-view: command__docname から抽出", () => {
    const html = fixture("template-view", "detail.html");
    expect(extractTitle(html)).toBe("令和６年第４回定例会（第５号） 本文");
  });

  test("doc-one-frame: command__title から抽出", () => {
    const html = fixture("doc-one-frame", "command.html");
    expect(extractTitle(html)).toBe("令和６年第４回定例会（第９号） 本文");
  });

  test("document-id: view__title から抽出", () => {
    const html = fixture("document-id", "detail.html");
    expect(extractTitle(html)).toBe("ＤＸ推進調査特別委員会 本文");
  });
});

describe("extractDate with real fixtures", () => {
  test("template-view: command__date から YYYY-MM-DD を抽出", () => {
    const html = fixture("template-view", "detail.html");
    expect(extractDate(html)).toBe("2024-12-17");
  });

  test("doc-one-frame: command フレームに日付なし", () => {
    const html = fixture("doc-one-frame", "command.html");
    expect(extractDate(html)).toBeNull();
  });

  test("document-id: view__date + time タグから抽出", () => {
    const html = fixture("document-id", "detail.html");
    expect(extractDate(html)).toBe("2024-12-26");
  });
});

describe("extractStatements with real fixtures", () => {
  test("template-view: voice-block 形式で発言を抽出", () => {
    const html = fixture("template-view", "detail.html");
    const stmts = extractStatements(html);

    expect(stmts.length).toBeGreaterThan(0);

    // 最初の発言者を検証
    expect(stmts[0]!.speakerRole).toBe("議長");
    expect(stmts[0]!.speakerName).toBe("高瀬博文");
    expect(stmts[0]!.kind).toBe("remark");
    expect(stmts[0]!.content.length).toBeGreaterThan(0);
    expect(stmts[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stmts[0]!.startOffset).toBe(0);
  });

  test("doc-one-frame: page-text__voice 形式で発言を抽出", () => {
    const html = fixture("doc-one-frame", "page.html");
    const stmts = extractStatements(html);

    expect(stmts.length).toBeGreaterThan(0);

    // 最初の entry は「午前10時開議」で発言者なし
    expect(stmts[0]!.speakerRole).toBeNull();
    expect(stmts[0]!.kind).toBe("remark");

    // 2番目の entry が議長の発言
    expect(stmts[1]!.speakerRole).toBe("議長");
    expect(stmts[1]!.speakerName).toBe("奈良岡隆");
    expect(stmts[1]!.kind).toBe("remark");

    // offset が連続していることを検証
    for (let i = 1; i < stmts.length; i++) {
      expect(stmts[i]!.startOffset).toBe(stmts[i - 1]!.endOffset + 1);
    }
  });

  test("document-id: voice__title + js-textwrap-container 形式で発言を抽出", () => {
    const html = fixture("document-id", "detail.html");
    const stmts = extractStatements(html);

    expect(stmts.length).toBeGreaterThan(0);

    // 最初の発言者（委員長）を検証
    expect(stmts[0]!.speakerRole).toBe("委員長");
    expect(stmts[0]!.kind).toBe("remark");

    // 行政側の答弁者が含まれることを検証
    const answerStmt = stmts.find((s) => s.kind === "answer");
    expect(answerStmt).toBeDefined();
  });
});

// --- fetchMeetingDetail 統合テスト ---

describe("fetchMeetingDetail integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("template-view: 旧形式の単一ページから MeetingData を取得", async () => {
    const detailHtml = fixture("template-view", "detail.html");

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(detailHtml),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchMeetingDetail(
      "https://www.town.otofuke.hokkaido.dbsr.jp/index.php/848322?Template=document&Id=1673",
      "test-municipality-id",
      "1673",
      "令和６年第４回定例会（第５号） 本文",
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和６年第４回定例会（第５号） 本文");
    expect(result!.heldOn).toBe("2024-12-17");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.externalId).toBe("dbsearch_1673");
    expect(result!.municipalityId).toBe("test-municipality-id");
    expect(result!.statements.length).toBeGreaterThan(0);
    expect(result!.statements[0]!.speakerName).toBe("高瀬博文");
  });

  test("doc-one-frame: フレームセット形式から MeetingData を取得", async () => {
    const framesetHtml = fixture("doc-one-frame", "frameset.html");
    const commandHtml = fixture("doc-one-frame", "command.html");
    const pageHtml = fixture("doc-one-frame", "page.html");

    const mockFetch = vi.fn();
    // 1st call: GET frameset
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(framesetHtml),
    });
    // 2nd call: GET command subframe
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(commandHtml),
    });
    // 3rd call: GET page subframe
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(pageHtml),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchMeetingDetail(
      "https://www.city.aomori.aomori.dbsr.jp/index.php/9585096?Template=doc-one-frame&VoiceType=onehit&DocumentID=1486",
      "test-municipality-id",
      "1486",
      "令和６年第４回定例会（第９号） 本文",
      "2024-12-25",
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和６年第４回定例会（第９号） 本文");
    // 日付は command フレームに無いため listDate からフォールバック
    expect(result!.heldOn).toBe("2024-12-25");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.externalId).toBe("dbsearch_1486");
    expect(result!.statements.length).toBeGreaterThan(0);
    // 2番目の発言者が議長（最初は「午前10時開議」で発言者なし）
    expect(result!.statements[1]!.speakerName).toBe("奈良岡隆");

    // doc-one-frame → doc-all-frame に変換されていることを確認
    const fetchedUrl = mockFetch.mock.calls[0]![0] as string;
    expect(fetchedUrl).toContain("Template=doc-all-frame");
    expect(fetchedUrl).toContain("VoiceType=all");
  });

  test("document-id: 中間形式の単一ページから MeetingData を取得", async () => {
    const detailHtml = fixture("document-id", "detail.html");

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(detailHtml),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchMeetingDetail(
      "https://www.city.sendai.miyagi.dbsr.jp/index.php/3431160?Template=view&VoiceType=all&DocumentID=16091",
      "test-municipality-id",
      "16091",
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("ＤＸ推進調査特別委員会 本文");
    expect(result!.heldOn).toBe("2024-12-26");
    expect(result!.meetingType).toBe("committee");
    expect(result!.externalId).toBe("dbsearch_16091");
    expect(result!.statements.length).toBeGreaterThan(0);
  });
});
