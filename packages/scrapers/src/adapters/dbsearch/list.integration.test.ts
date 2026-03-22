import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchMeetingList, parseListHtml, hasNextPage } from "./list";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );

// --- parseListHtml 単体テスト（実データ） ---

describe("parseListHtml with real fixtures", () => {
  test("template-view: Template=document リンクからレコードを抽出", () => {
    const html = fixture("template-view", "search-result.html");
    const records = parseListHtml(
      html,
      "https://www.town.otofuke.hokkaido.dbsr.jp",
    );

    expect(records).toHaveLength(10);
    expect(records[0]!.id).toBe("1674");
    expect(records[0]!.title).toBe("令和６年第４回定例会（第５号） 名簿");
    expect(records[0]!.url).toContain("Template=document");
    expect(records[0]!.date).toBeNull();

    expect(records[1]!.id).toBe("1673");
    expect(records[1]!.title).toBe("令和６年第４回定例会（第５号） 本文");
  });

  test("doc-one-frame: Template=doc-one-frame リンクと日付を抽出", () => {
    const html = fixture("doc-one-frame", "search-result.html");
    const records = parseListHtml(
      html,
      "https://www.city.aomori.aomori.dbsr.jp",
    );

    expect(records).toHaveLength(20);
    expect(records[0]!.id).toBe("1485");
    expect(records[0]!.title).toBe(
      "令和６年第４回定例会（第９号） 議事日程・名簿",
    );
    expect(records[0]!.url).toContain("Template=doc-one-frame");
    expect(records[0]!.date).toBe("2024-12-25");

    expect(records[1]!.id).toBe("1486");
    expect(records[1]!.title).toBe("令和６年第４回定例会（第９号） 本文");
    expect(records[1]!.date).toBe("2024-12-25");
  });

  test("document-id: Template=view + DocumentID リンクからレコードを抽出", () => {
    const html = fixture("document-id", "search-result.html");
    const records = parseListHtml(
      html,
      "https://www.city.sendai.miyagi.dbsr.jp",
    );

    expect(records).toHaveLength(10);
    expect(records[0]!.id).toBe("16088");
    expect(records[0]!.title).toBe("ＤＸ推進調査特別委員会 表紙");
    expect(records[0]!.url).toContain("DocumentID=16088");

    expect(records[3]!.id).toBe("16091");
    expect(records[3]!.title).toBe("ＤＸ推進調査特別委員会 本文");
  });
});

describe("hasNextPage with real fixtures", () => {
  test("template-view: 次のページボタンがある", () => {
    const html = fixture("template-view", "search-result.html");
    expect(hasNextPage(html)).toBe(true);
  });

  test("doc-one-frame: 次のページボタンがない", () => {
    const html = fixture("doc-one-frame", "search-result.html");
    expect(hasNextPage(html)).toBe(false);
  });
});

// --- fetchMeetingList 統合テスト ---

describe("fetchMeetingList integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("template-view: 音更町の検索フローで一覧を取得", async () => {
    const topHtml = fixture("template-view", "top.html");
    const searchHtml = fixture("template-view", "search-result.html");

    const mockFetch = vi.fn();
    // 1st call: GET top page
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(topHtml),
      headers: new Headers({ "set-cookie": "session=test; path=/" }),
    });
    // 2nd call: POST search
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(searchHtml),
      headers: new Headers(),
    });
    // hasNextPage=true → 3rd call for page 2 returns empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("<html></html>"),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    const records = await fetchMeetingList(
      "https://www.town.otofuke.hokkaido.dbsr.jp/index.php/4880599?Template=search-detail",
      2024,
    );

    expect(records).not.toBeNull();
    expect(records!.length).toBe(10);
    expect(records![0]!.id).toBe("1674");
    expect(records![0]!.title).toBe("令和６年第４回定例会（第５号） 名簿");

    // POST が正しいパラメータで呼ばれたことを確認
    const postCall = mockFetch.mock.calls[1];
    expect(postCall![1].method).toBe("POST");
    const body = postCall![1].body as string;
    expect(body).toContain("TermStartYear=2024");
    expect(body).toContain("TermEndYear=2024");
  });

  test("doc-one-frame: 青森市の検索フローで一覧を取得", async () => {
    const topHtml = fixture("doc-one-frame", "top.html");
    const searchHtml = fixture("doc-one-frame", "search-result.html");

    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(topHtml),
      headers: new Headers({ "set-cookie": "DSNeo=abc; path=/" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(searchHtml),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    const records = await fetchMeetingList(
      "https://www.city.aomori.aomori.dbsr.jp/index.php/",
      2024,
    );

    expect(records).not.toBeNull();
    expect(records!.length).toBe(20);
    expect(records![1]!.id).toBe("1486");
    expect(records![1]!.title).toBe("令和６年第４回定例会（第９号） 本文");
    expect(records![1]!.date).toBe("2024-12-25");
  });

  test("document-id: 仙台市の検索フローで一覧を取得", async () => {
    const topHtml = fixture("document-id", "top.html");
    const searchHtml = fixture("document-id", "search-result.html");

    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(topHtml),
      headers: new Headers({ "set-cookie": "DSNeo=xyz; path=/" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(searchHtml),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    const records = await fetchMeetingList(
      "https://www.city.sendai.miyagi.dbsr.jp/index.php/",
      2024,
    );

    expect(records).not.toBeNull();
    expect(records!.length).toBe(10);
    expect(records![0]!.id).toBe("16088");
    expect(records![0]!.title).toBe("ＤＸ推進調査特別委員会 表紙");
    expect(records![3]!.id).toBe("16091");
    expect(records![3]!.title).toBe("ＤＸ推進調査特別委員会 本文");
  });
});
