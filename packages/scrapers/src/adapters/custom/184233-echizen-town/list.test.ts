import { describe, expect, it } from "vitest";
import { parseIndexPage } from "./list";
import {
  buildHeldOn,
  detectMeetingType,
  extractYearMonth,
  isGeneralQuestion,
} from "./shared";

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和7年9月 越前町議会定例会 議事録")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和7年第2回越前町議会臨時会 議事録")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  it("不明な場合は plenary を返す", () => {
    expect(detectMeetingType("会議録")).toBe("plenary");
  });
});

describe("isGeneralQuestion", () => {
  it("一般質問会議録を判定する", () => {
    expect(isGeneralQuestion("令和7年9月定例会・一般質問会議録")).toBe(true);
  });

  it("本会議議事録は false", () => {
    expect(isGeneralQuestion("令和7年9月 越前町議会定例会 議事録")).toBe(false);
  });
});

describe("extractYearMonth", () => {
  it("令和の定例会タイトルから年月を抽出する", () => {
    expect(extractYearMonth("令和7年9月 越前町議会定例会 議事録")).toEqual({
      year: 2025,
      month: 9,
    });
  });

  it("令和の一般質問タイトルから年月を抽出する", () => {
    expect(extractYearMonth("令和7年9月定例会・一般質問会議録")).toEqual({
      year: 2025,
      month: 9,
    });
  });

  it("令和の臨時会（月なし）タイトルから年を抽出する", () => {
    expect(extractYearMonth("令和7年第2回越前町議会臨時会 議事録")).toEqual({
      year: 2025,
      month: null,
    });
  });

  it("平成の定例会タイトルから年月を抽出する", () => {
    expect(extractYearMonth("平成29年3月　越前町議会定例会　議事録")).toEqual({
      year: 2017,
      month: 3,
    });
  });

  it("平成の臨時会タイトルから年を抽出する", () => {
    expect(extractYearMonth("平成31年第1回 越前町議会臨時会 議事録")).toEqual({
      year: 2019,
      month: null,
    });
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearMonth("令和元年12月 越前町議会定例会 議事録")).toEqual({
      year: 0,
      month: null,
    });
  });
});

describe("buildHeldOn", () => {
  it("年月から YYYY-MM-01 形式を返す", () => {
    expect(buildHeldOn(2025, 9)).toBe("2025-09-01");
  });

  it("月が1桁でもゼロパディングする", () => {
    expect(buildHeldOn(2025, 3)).toBe("2025-03-01");
  });

  it("月が null の場合は YYYY-01-01 を返す", () => {
    expect(buildHeldOn(2025, null)).toBe("2025-01-01");
  });

  it("年が 0 の場合は空文字列を返す", () => {
    expect(buildHeldOn(0, null)).toBe("");
  });
});

describe("parseIndexPage", () => {
  it("定例会の本会議議事録リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/chousei/04/06/p009573.html">令和7年9月 越前町議会定例会 議事録</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "令和7年9月 越前町議会定例会 議事録",
      detailUrl: "https://www.town.echizen.fukui.jp/chousei/04/06/p009573.html",
      pagePath: "/chousei/04/06/p009573.html",
      pageId: "p009573",
      meetingType: "plenary",
      generalQuestion: false,
      heldOn: "2025-09-01",
    });
  });

  it("臨時会の議事録リンクを抽出する", () => {
    const html = `
      <a href="/chousei/04/06/p009445.html">令和7年第2回越前町議会臨時会 議事録</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.generalQuestion).toBe(false);
  });

  it("一般質問会議録リンクを抽出する", () => {
    const html = `
      <a href="/chousei/04/06/p009544.html">令和7年9月定例会・一般質問会議録</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.generalQuestion).toBe(true);
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("平成の議事録リンクを抽出する", () => {
    const html = `
      <a href="/chousei/04/06/p005179.html">平成29年3月　越前町議会定例会　議事録</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2017-03-01");
    expect(result[0]!.pageId).toBe("p005179");
  });

  it("複数リンクを正しく抽出する", () => {
    const html = `
      <ul>
        <li><a href="/chousei/04/06/p009573.html">令和7年9月 越前町議会定例会 議事録</a></li>
        <li><a href="/chousei/04/06/p009544.html">令和7年9月定例会・一般質問会議録</a></li>
        <li><a href="/chousei/04/06/p009445.html">令和7年第2回越前町議会臨時会 議事録</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.pageId).toBe("p009573");
    expect(result[1]!.pageId).toBe("p009544");
    expect(result[2]!.pageId).toBe("p009445");
  });

  it("重複リンクは除外する", () => {
    const html = `
      <a href="/chousei/04/06/p009573.html">令和7年9月 越前町議会定例会 議事録</a>
      <a href="/chousei/04/06/p009573.html">令和7年9月 越前町議会定例会 議事録</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
  });

  it("パターンに合致しないリンクは無視する", () => {
    const html = `
      <a href="/chousei/04/06/index.html">トップに戻る</a>
      <a href="https://example.com">外部リンク</a>
      <a href="/chousei/04/06/p009573.html">令和7年9月 越前町議会定例会 議事録</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
  });

  it("リンクテキストが空の場合はスキップする", () => {
    const html = `
      <a href="/chousei/04/06/p009573.html"></a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(0);
  });
});
