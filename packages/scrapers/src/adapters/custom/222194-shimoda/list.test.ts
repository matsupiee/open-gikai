import { describe, it, expect } from "vitest";
import {
  parseWarekiDateCode,
  parseJapaneseDate,
  parseSessionTitle,
  parseSessionLinks,
  parseSessionPage,
} from "./list";

describe("parseWarekiDateCode", () => {
  it("令和6年12月5日のコードを変換する", () => {
    expect(parseWarekiDateCode("061205")).toBe("2024-12-05");
  });

  it("令和7年3月1日のコードを変換する", () => {
    expect(parseWarekiDateCode("070301")).toBe("2025-03-01");
  });

  it("令和元年9月1日のコードを変換する", () => {
    expect(parseWarekiDateCode("010901")).toBe("2019-09-01");
  });

  it("月日を0埋めする", () => {
    expect(parseWarekiDateCode("060301")).toBe("2024-03-01");
  });

  it("不正なコードは null を返す", () => {
    expect(parseWarekiDateCode("abc")).toBeNull();
  });

  it("桁数が不足する場合は null を返す", () => {
    expect(parseWarekiDateCode("0612")).toBeNull();
  });
});

describe("parseJapaneseDate", () => {
  it("令和の日付を変換する", () => {
    expect(parseJapaneseDate("令和7年12月3日")).toBe("2025-12-03");
  });

  it("令和元年を変換する", () => {
    expect(parseJapaneseDate("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(parseJapaneseDate("平成31年3月15日")).toBe("2019-03-15");
  });

  it("月日を0埋めする", () => {
    expect(parseJapaneseDate("令和6年3月1日")).toBe("2024-03-01");
  });

  it("不正なテキストは null を返す", () => {
    expect(parseJapaneseDate("2025年12月3日")).toBeNull();
  });
});

describe("parseSessionTitle", () => {
  it("令和の定例会タイトルをパースする", () => {
    const result = parseSessionTitle("令和6年12月定例会");

    expect(result).not.toBeNull();
    expect(result!.section).toBe("12月定例会");
    expect(result!.title).toBe("令和6年12月定例会");
    expect(result!.year).toBe(2024);
  });

  it("令和の臨時会タイトルをパースする", () => {
    const result = parseSessionTitle("令和6年1月臨時会");

    expect(result).not.toBeNull();
    expect(result!.section).toBe("1月臨時会");
    expect(result!.title).toBe("令和6年1月臨時会");
    expect(result!.year).toBe(2024);
  });

  it("令和元年のタイトルをパースする", () => {
    const result = parseSessionTitle("令和元年9月定例会");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
  });

  it("平成のタイトルをパースする", () => {
    const result = parseSessionTitle("平成31年3月定例会");

    expect(result).not.toBeNull();
    expect(result!.section).toBe("3月定例会");
    expect(result!.year).toBe(2019);
  });

  it("不正なタイトルは null を返す", () => {
    expect(parseSessionTitle("会議録一覧")).toBeNull();
  });
});

describe("parseSessionLinks", () => {
  it("090100kaigiroku カテゴリの会期ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/category/090100kaigiroku/157640.html">令和6年12月定例会</a></li>
        <li><a href="/category/090100kaigiroku/157395.html">令和6年9月定例会</a></li>
      </ul>
    `;

    const links = parseSessionLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0]).toBe(
      "https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/157640.html"
    );
    expect(links[1]).toBe(
      "https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/157395.html"
    );
  });

  it("h28_kaigiroku カテゴリの会期ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/category/h28_kaigiroku/123456.html">平成28年12月定例会</a></li>
      </ul>
    `;

    const links = parseSessionLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]).toBe(
      "https://www.city.shimoda.shizuoka.jp/category/h28_kaigiroku/123456.html"
    );
  });

  it("重複するリンクは除去する", () => {
    const html = `
      <a href="/category/090100kaigiroku/157640.html">令和6年12月定例会</a>
      <a href="/category/090100kaigiroku/157640.html">令和6年12月定例会（再掲）</a>
    `;

    const links = parseSessionLinks(html);

    expect(links).toHaveLength(1);
  });

  it("無関係なリンクはスキップする", () => {
    const html = `
      <a href="/category/090100kaigiroku/157640.html">令和6年12月定例会</a>
      <a href="/other/page.html">その他</a>
      <a href="/category/090100kaigiroku/index.html">会議録一覧</a>
    `;

    const links = parseSessionLinks(html);

    // index.html はカテゴリページではなくインデックスなのでスキップ
    // 数値IDを持つものだけが対象
    expect(links).toHaveLength(1);
    expect(links[0]).toContain("157640");
  });
});

describe("parseSessionPage", () => {
  it("会議録本文 PDF リンクを抽出する", () => {
    const html = `
      <h1>令和6年12月定例会</h1>
      <ul>
        <li><a href="/file/%E4%BC%9A%E8%AD%B0%E9%8C%B2%E6%9C%AC%E6%96%87%EF%BC%88061205%EF%BC%89.pdf">会議録本文（061205）</a></li>
        <li><a href="/file/%E4%BC%9A%E8%AD%B0%E9%8C%B2%E6%9C%AC%E6%96%87%EF%BC%88061206%EF%BC%89.pdf">会議録本文（061206）</a></li>
      </ul>
    `;

    const meetings = parseSessionPage(html, "令和6年12月定例会", "12月定例会", 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-12-05");
    expect(meetings[1]!.heldOn).toBe("2024-12-06");
    expect(meetings[0]!.title).toBe("令和6年12月定例会");
    expect(meetings[0]!.section).toBe("12月定例会");
  });

  it("会議録本文以外のリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/file/%E8%AD%B0%E4%BA%8B%E6%97%A5%E7%A8%8B%EF%BC%88061205%EF%BC%89.pdf">議事日程（061205）</a></li>
        <li><a href="/file/%E4%BC%9A%E8%AD%B0%E9%8C%B2%E6%9C%AC%E6%96%87%EF%BC%88061205%EF%BC%89.pdf">会議録本文（061205）</a></li>
        <li><a href="/file/%E5%87%BA%E5%B8%AD%E8%80%85%E4%B8%80%E8%A6%A7%E8%A1%A8%EF%BC%88061205%EF%BC%89.pdf">出席者一覧表（061205）</a></li>
      </ul>
    `;

    const meetings = parseSessionPage(html, "令和6年12月定例会", "12月定例会", 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-05");
  });

  it("年度が異なるものはフィルタリングする", () => {
    const html = `
      <ul>
        <li><a href="/file/%E4%BC%9A%E8%AD%B0%E9%8C%B2%E6%9C%AC%E6%96%87%EF%BC%88061205%EF%BC%89.pdf">会議録本文（061205）</a></li>
      </ul>
    `;

    const meetings2025 = parseSessionPage(html, "令和6年12月定例会", "12月定例会", 2025);
    expect(meetings2025).toHaveLength(0);

    const meetings2024 = parseSessionPage(html, "令和6年12月定例会", "12月定例会", 2024);
    expect(meetings2024).toHaveLength(1);
  });

  it("日本語ファイル名（未エンコード）の場合も抽出できる", () => {
    const html = `
      <ul>
        <li><a href="/file/会議録本文（061205）.pdf">会議録本文（061205）</a></li>
      </ul>
    `;

    const meetings = parseSessionPage(html, "令和6年12月定例会", "12月定例会", 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-05");
  });
});
