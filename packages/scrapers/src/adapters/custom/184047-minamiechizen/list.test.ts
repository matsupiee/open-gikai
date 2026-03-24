import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import {
  buildHeldOn,
  detectMeetingType,
  extractYearMonth,
  getNendoCodesForYear,
} from "./shared";

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和6年12月定例会　会議録")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和6年11月臨時会　会議録")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会　会議録")).toBe("committee");
  });

  it("不明な場合は plenary を返す", () => {
    expect(detectMeetingType("会議録")).toBe("plenary");
  });
});

describe("extractYearMonth", () => {
  it("令和の定例会タイトルから年月を抽出する", () => {
    expect(extractYearMonth("令和6年12月定例会　会議録")).toEqual({
      year: 2024,
      month: 12,
    });
  });

  it("令和の臨時会タイトルから年月を抽出する", () => {
    expect(extractYearMonth("令和6年11月臨時会　会議録")).toEqual({
      year: 2024,
      month: 11,
    });
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearMonth("令和元年12月定例会　会議録")).toEqual({
      year: 2019,
      month: 12,
    });
  });

  it("令和7年3月定例会（翌年度跨ぎ）を正しく変換する", () => {
    expect(extractYearMonth("令和7年3月定例会　会議録")).toEqual({
      year: 2025,
      month: 3,
    });
  });

  it("平成の定例会タイトルから年月を抽出する", () => {
    expect(extractYearMonth("平成30年12月定例会　会議録")).toEqual({
      year: 2018,
      month: 12,
    });
  });

  it("解析できないタイトルは { year: 0, month: null } を返す", () => {
    expect(extractYearMonth("その他の会議録")).toEqual({
      year: 0,
      month: null,
    });
  });
});

describe("buildHeldOn", () => {
  it("年月から YYYY-MM-01 形式を返す", () => {
    expect(buildHeldOn(2024, 12)).toBe("2024-12-01");
  });

  it("月が1桁でもゼロパディングする", () => {
    expect(buildHeldOn(2024, 3)).toBe("2024-03-01");
  });

  it("月が null の場合は YYYY-01-01 を返す", () => {
    expect(buildHeldOn(2024, null)).toBe("2024-01-01");
  });

  it("年が 0 の場合は null を返す", () => {
    expect(buildHeldOn(0, null)).toBeNull();
  });
});

describe("getNendoCodesForYear", () => {
  it("2024年に対応する年度コードを返す（r5とr6）", () => {
    const codes = getNendoCodesForYear(2024);
    expect(codes).toContain("r5");
    expect(codes).toContain("r6");
  });

  it("2019年に対応する年度コードを返す（r1とh30）", () => {
    const codes = getNendoCodesForYear(2019);
    expect(codes).toContain("r1");
    expect(codes).toContain("h30");
  });
});

describe("parseListPage", () => {
  it("定例会リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="p010808.html">令和6年12月定例会　会議録</a></li>
      </ul>
    `;

    const result = parseListPage(html, "r6");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "令和6年12月定例会　会議録",
      detailUrl: "https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/r6/p010808.html",
      pdfUrl: "https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/r6/p010808_d/fil/gikai1.pdf",
      pageId: "p010808",
      nendoCode: "r6",
      meetingType: "plenary",
      heldOn: "2024-12-01",
    });
  });

  it("臨時会リンクを抽出する", () => {
    const html = `
      <a href="p010751.html">令和6年11月臨時会　会議録</a>
    `;

    const result = parseListPage(html, "r6");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-11-01");
  });

  it("平成の議事録リンクを抽出する", () => {
    const html = `
      <a href="p001234.html">平成30年12月定例会　会議録</a>
    `;

    const result = parseListPage(html, "h30");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2018-12-01");
    expect(result[0]!.pageId).toBe("p001234");
    expect(result[0]!.nendoCode).toBe("h30");
  });

  it("複数リンクを正しく抽出する", () => {
    const html = `
      <ul>
        <li><a href="p011003.html">令和7年3月定例会　会議録</a></li>
        <li><a href="p010808.html">令和6年12月定例会　会議録</a></li>
        <li><a href="p010751.html">令和6年11月臨時会　会議録</a></li>
      </ul>
    `;

    const result = parseListPage(html, "r6");

    expect(result).toHaveLength(3);
    expect(result[0]!.pageId).toBe("p011003");
    expect(result[1]!.pageId).toBe("p010808");
    expect(result[2]!.pageId).toBe("p010751");
  });

  it("重複リンクは除外する", () => {
    const html = `
      <a href="p010808.html">令和6年12月定例会　会議録</a>
      <a href="p010808.html">令和6年12月定例会　会議録</a>
    `;

    const result = parseListPage(html, "r6");

    expect(result).toHaveLength(1);
  });

  it("パターンに合致しないリンクは無視する", () => {
    const html = `
      <a href="index.html">トップに戻る</a>
      <a href="https://example.com">外部リンク</a>
      <a href="p010808.html">令和6年12月定例会　会議録</a>
    `;

    const result = parseListPage(html, "r6");

    expect(result).toHaveLength(1);
  });

  it("リンクテキストが空の場合はスキップする", () => {
    const html = `
      <a href="p010808.html"></a>
    `;

    const result = parseListPage(html, "r6");

    expect(result).toHaveLength(0);
  });

  it("絶対パス形式のリンクも抽出する", () => {
    const html = `
      <a href="/tyougikai/kaigiroku/r6/p010808.html">令和6年12月定例会　会議録</a>
    `;

    const result = parseListPage(html, "r6");

    expect(result).toHaveLength(1);
    expect(result[0]!.pageId).toBe("p010808");
  });
});
