import { describe, expect, it } from "vitest";
import {
  parseYearlyPageLinks,
  parseDetailPageLinks,
  parsePdfUrl,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年会議録")).toBe(2025);
    expect(parseWarekiYear("令和6年会議録")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年会議録")).toBe(2019);
  });

  it("全角数字を正しく変換する", () => {
    expect(parseWarekiYear("令和７年")).toBe(2025);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成２５年第１回")).toBe(2013);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6年第1回坂城町議会定例会会議録")).toBe(
      "plenary"
    );
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和6年第1回坂城町議会臨時会会議録")).toBe(
      "extraordinary"
    );
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearlyPageLinks", () => {
  it("/site/gikai/list10-XX.html パターンのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list10-45.html">令和7年会議録</a></li>
        <li><a href="/site/gikai/list10-46.html">令和6年会議録</a></li>
        <li><a href="/site/gikai/list10-47.html">令和5年会議録</a></li>
      </ul>
    `;

    const result = parseYearlyPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe(
      "https://www.town.sakaki.nagano.jp/site/gikai/list10-45.html"
    );
    expect(result[0]!.title).toBe("令和7年会議録");
    expect(result[1]!.url).toBe(
      "https://www.town.sakaki.nagano.jp/site/gikai/list10-46.html"
    );
    expect(result[1]!.title).toBe("令和6年会議録");
  });

  it("list10-XX.html 以外のリンクは含まない", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list10-46.html">令和6年会議録</a></li>
        <li><a href="/site/gikai/1478.html">令和6年第1回定例会</a></li>
        <li><a href="/other/page.html">別ページ</a></li>
      </ul>
    `;

    const result = parseYearlyPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.town.sakaki.nagano.jp/site/gikai/list10-46.html"
    );
  });

  it("重複したリンクは除去される", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list10-46.html">令和6年会議録</a></li>
        <li><a href="/site/gikai/list10-46.html">令和6年会議録（再掲）</a></li>
      </ul>
    `;

    const result = parseYearlyPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseYearlyPageLinks("<p>会議録なし</p>")).toEqual([]);
  });
});

describe("parseDetailPageLinks", () => {
  it("/site/gikai/{数字}.html パターンのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/1478.html">令和6年第1回坂城町議会定例会会議録</a></li>
        <li><a href="/site/gikai/1415.html">令和6年第2回坂城町議会定例会会議録</a></li>
        <li><a href="/site/gikai/1345.html">令和6年第3回坂城町議会定例会会議録</a></li>
      </ul>
    `;

    const result = parseDetailPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe(
      "https://www.town.sakaki.nagano.jp/site/gikai/1478.html"
    );
    expect(result[0]!.title).toBe("令和6年第1回坂城町議会定例会会議録");
    expect(result[1]!.url).toBe(
      "https://www.town.sakaki.nagano.jp/site/gikai/1415.html"
    );
    expect(result[1]!.title).toBe("令和6年第2回坂城町議会定例会会議録");
  });

  it("list10-XX.html パターンのリンクは含まない", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list10-46.html">令和6年会議録</a></li>
        <li><a href="/site/gikai/1478.html">令和6年第1回定例会</a></li>
      </ul>
    `;

    const result = parseDetailPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.town.sakaki.nagano.jp/site/gikai/1478.html"
    );
  });

  it("重複したリンクは除去される", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/1478.html">令和6年第1回定例会</a></li>
        <li><a href="/site/gikai/1478.html">令和6年第1回定例会（再掲）</a></li>
      </ul>
    `;

    const result = parseDetailPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseDetailPageLinks("<p>会議録なし</p>")).toEqual([]);
  });
});

describe("parsePdfUrl", () => {
  it("全ページ一括ダウンロードリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/2803.pdf">全ページ一括ダウンロード [PDFファイル／1.69MB]</a></li>
        <li><a href="/uploaded/attachment/2804.pdf">分割 日程 [PDFファイル／123KB]</a></li>
        <li><a href="/uploaded/attachment/2807.pdf">分割 会議録1日目 [PDFファイル／848KB]</a></li>
      </ul>
    `;

    const result = parsePdfUrl(html);

    expect(result).toBe(
      "https://www.town.sakaki.nagano.jp/uploaded/attachment/2803.pdf"
    );
  });

  it("全ページ一括がない場合はnullを返す", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/2804.pdf">分割 日程 [PDFファイル／123KB]</a></li>
        <li><a href="/uploaded/attachment/2807.pdf">分割 会議録1日目 [PDFファイル／848KB]</a></li>
      </ul>
    `;

    expect(parsePdfUrl(html)).toBeNull();
  });

  it("PDFリンクがない場合はnullを返す", () => {
    expect(parsePdfUrl("<p>PDFなし</p>")).toBeNull();
  });
});
