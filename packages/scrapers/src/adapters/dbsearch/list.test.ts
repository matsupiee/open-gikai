import { describe, expect, test } from "vitest";
import {
  extractCsrfToken,
  extractFormActionId,
  extractEndpointIdFromUrl,
  parseListHtml,
  hasNextPage,
} from "./list";

describe("extractCsrfToken", () => {
  test("meta タグから CSRF トークンを抽出", () => {
    const html =
      '<meta name="csrf-token" content="abc123def456">';
    expect(extractCsrfToken(html)).toBe("abc123def456");
  });

  test("マッチしない場合は null", () => {
    expect(extractCsrfToken("<div>no token</div>")).toBeNull();
  });
});

describe("extractFormActionId", () => {
  test("旧形式の action URL から ID を抽出", () => {
    const html = '<form action="https://foo.dbsr.jp/index.php/12345">';
    expect(extractFormActionId(html)).toBe("12345");
  });

  test("新形式の action URL から ID を抽出", () => {
    const html =
      '<form action="https://www.record.gikai.metro.tokyo.lg.jp/916983">';
    expect(extractFormActionId(html)).toBe("916983");
  });

  test("クエリパラメータ付き", () => {
    const html =
      '<form action="https://www.record.gikai.metro.tokyo.lg.jp/916983?Template=list">';
    expect(extractFormActionId(html)).toBe("916983");
  });

  test("マッチしない場合は null", () => {
    expect(extractFormActionId('<form action="/search">')).toBeNull();
  });
});

describe("extractEndpointIdFromUrl", () => {
  test("旧形式 /index.php/12345", () => {
    expect(
      extractEndpointIdFromUrl("https://foo.dbsr.jp/index.php/12345")
    ).toBe("12345");
  });

  test("新形式 /100000?Template=search-phrase", () => {
    expect(
      extractEndpointIdFromUrl(
        "https://www.record.gikai.metro.tokyo.lg.jp/100000?Template=search-phrase"
      )
    ).toBe("100000");
  });
});

describe("parseListHtml", () => {
  test("Template=view のリンクからレコードを抽出", () => {
    const html = `
      <a href="/index.php/12345?Template=view&amp;Id=100">令和６年第１回定例会</a>
      <a href="/index.php/12345?Template=view&amp;Id=101">令和６年第２回定例会</a>
    `;
    const records = parseListHtml(html, "https://foo.dbsr.jp");
    expect(records).toHaveLength(2);
    expect(records[0]!.id).toBe("100");
    expect(records[0]!.title).toBe("令和６年第１回定例会");
    expect(records[0]!.url).toContain("Template=view");
    expect(records[0]!.date).toBeNull();
    expect(records[1]!.id).toBe("101");
  });

  test("Template=document のリンクも抽出される", () => {
    const html =
      '<a href="/12345?Template=document&Id=200">委員会記録</a>';
    const records = parseListHtml(html, "https://example.com");
    expect(records).toHaveLength(1);
    expect(records[0]!.id).toBe("200");
  });

  test("重複する docId は除外される", () => {
    const html = `
      <a href="/12345?Template=view&Id=100">同じ会議 第1版</a>
      <a href="/12345?Template=view&Id=100#page1">同じ会議 第2版</a>
    `;
    const records = parseListHtml(html, "https://foo.dbsr.jp");
    expect(records).toHaveLength(1);
  });

  test("相対URLにoriginが付与される", () => {
    const html =
      '<a href="/index.php/12345?Template=view&amp;Id=100">テスト</a>';
    const records = parseListHtml(html, "https://foo.dbsr.jp");
    expect(records[0]!.url.startsWith("https://foo.dbsr.jp")).toBe(true);
  });

  test("Template=doc-one-frame のリンクからレコードを抽出", () => {
    const html = `
      <div class="result-title">
        <a href="/index.php/1234567?Template=doc-one-frame&amp;VoiceType=onehit&amp;DocumentID=500">令和７年第１回定例会</a>
        <span class="result-title__date">2025-12-24</span>
      </div>
      <div class="result-title">
        <a href="/index.php/1234567?Template=doc-one-frame&amp;VoiceType=onehit&amp;DocumentID=501">令和７年第２回定例会</a>
        <span class="result-title__date">2025-12-11</span>
      </div>
    `;
    const records = parseListHtml(html, "https://www.city.aomori.aomori.dbsr.jp");
    expect(records).toHaveLength(2);
    expect(records[0]!.id).toBe("500");
    expect(records[0]!.title).toBe("令和７年第１回定例会");
    expect(records[0]!.date).toBe("2025-12-24");
    expect(records[1]!.id).toBe("501");
    expect(records[1]!.date).toBe("2025-12-11");
  });

  test("Template=doc-all-frame のリンクからレコードを抽出", () => {
    const html =
      '<a href="/index.php/2753880?Template=doc-all-frame&amp;VoiceType=all&amp;DocumentID=600">令和７年第１回定例会</a>';
    const records = parseListHtml(html, "https://www.city.shizuoka.shizuoka.dbsr.jp");
    expect(records).toHaveLength(1);
    expect(records[0]!.id).toBe("600");
  });

  test("新形式の DocumentID パラメータからレコードを抽出", () => {
    const html = `
      <a href="/index.php/7519522?Template=view&amp;VoiceType=all&amp;DocumentID=3650">令和７年 意見書第０４号</a>
      <a href="/index.php/7519522?Template=view&amp;VoiceType=all&amp;DocumentID=3651">令和７年 意見書第０５号</a>
    `;
    const records = parseListHtml(html, "https://www.city.sendai.miyagi.dbsr.jp");
    expect(records).toHaveLength(2);
    expect(records[0]!.id).toBe("3650");
    expect(records[0]!.title).toBe("令和７年 意見書第０４号");
    expect(records[1]!.id).toBe("3651");
  });

  test("日本語日付形式の span からも日付を抽出", () => {
    const html = `
      <a href="/index.php/12345?Template=doc-one-frame&amp;VoiceType=onehit&amp;DocumentID=700">定例会</a>
      <span class="date">2025年12月19日</span>
    `;
    const records = parseListHtml(html, "https://example.dbsr.jp");
    expect(records).toHaveLength(1);
    expect(records[0]!.date).toBe("2025-12-19");
  });

  test("開催日プレフィックス付き日付を抽出", () => {
    const html = `
      <a href="/index.php/12345?Template=doc-one-frame&amp;VoiceType=onehit&amp;DocumentID=800">定例会</a>
      <span class="result-title__date">開催日：2025-12-11</span>
    `;
    const records = parseListHtml(html, "https://example.dbsr.jp");
    expect(records).toHaveLength(1);
    expect(records[0]!.date).toBe("2025-12-11");
  });
});

describe("hasNextPage", () => {
  test("次のページボタンがある場合は true", () => {
    const html =
      '<button aria-label="次のページ" aria-disabled="false">次へ</button>';
    expect(hasNextPage(html)).toBe(true);
  });

  test("次のページボタンが disabled の場合は false", () => {
    const html =
      '<button aria-label="次のページ" aria-disabled="true">次へ</button>';
    expect(hasNextPage(html)).toBe(false);
  });

  test("次のページボタンがない場合は false", () => {
    expect(hasNextPage("<div>結果一覧</div>")).toBe(false);
  });
});
