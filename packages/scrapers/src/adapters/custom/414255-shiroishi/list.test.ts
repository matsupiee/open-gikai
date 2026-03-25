import { describe, expect, it } from "vitest";
import { parseTopPage, parseYearPage, parseMeetingPage } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年3月 定例会")).toBe(2025);
    expect(parseWarekiYear("令和元年9月 定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成29年3月 定例会")).toBe(2017);
    expect(parseWarekiYear("平成30年12月 定例会")).toBe(2018);
    expect(parseWarekiYear("平成元年4月 定例会")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和7年3月 定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和7年2月 臨時会")).toBe("extraordinary");
  });

  it("臨時議会は extraordinary を返す", () => {
    expect(detectMeetingType("平成29年2月 臨時議会")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("令和7年 総務委員会")).toBe("committee");
  });
});

describe("parseTopPage", () => {
  it("トップページから年度別ページURLを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy.html">令和7年</a></li>
        <li><a href="/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2.html">令和6年</a></li>
      </ul>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy.html",
    );
    expect(result[1]).toBe(
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2.html",
    );
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/chousei_machi/gikai/kaigiroku/h27_copy_copy.html">令和7年</a>
      <a href="/chousei_machi/gikai/kaigiroku/h27_copy_copy.html">令和7年（重複）</a>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
  });

  it("kaigiroku/ 配下でないリンクを除外する", () => {
    const html = `
      <a href="/chousei_machi/gikai/index.html">議会トップ</a>
      <a href="/chousei_machi/gikai/kaigiroku/h27_copy_copy.html">平成29年</a>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseTopPage(html)).toEqual([]);
  });
});

describe("parseYearPage", () => {
  it("年度別ページから会議別詳細ページリンクを抽出する", () => {
    const yearPageUrl =
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy.html";
    const html = `
      <ul>
        <li><a href="./_7932.html">令和7年3月 定例会</a></li>
        <li><a href="./_7931.html">令和7年2月 臨時会</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年3月 定例会",
      url: "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy/_7932.html",
    });
    expect(result[1]).toEqual({
      title: "令和7年2月 臨時会",
      url: "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy/_7931.html",
    });
  });

  it("絶対URLのリンクをそのまま使用する", () => {
    const yearPageUrl =
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy.html";
    const html = `
      <a href="https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy/_2807.html">平成29年3月 定例会</a>
    `;

    const result = parseYearPage(html, yearPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy/_2807.html",
    );
  });

  it("重複リンクを除外する", () => {
    const yearPageUrl =
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy.html";
    const html = `
      <a href="./_2807.html">平成29年3月 定例会</a>
      <a href="./_2807.html">平成29年3月 定例会（重複）</a>
    `;

    const result = parseYearPage(html, yearPageUrl);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(
      parseYearPage(html, "https://www.town.shiroishi.lg.jp/test.html"),
    ).toEqual([]);
  });
});

describe("parseMeetingPage", () => {
  it("会議別詳細ページからPDFリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/var/rev0/0002/7885/kaigiroku.pdf">3月6日</a></li>
        <li><a href="/var/rev0/0002/7886/kaigiroku.pdf">3月7日</a></li>
        <li><a href="/var/rev0/0002/7887/kaigiroku.pdf">3月8日</a></li>
      </ul>
    `;

    const result = parseMeetingPage(
      html,
      "令和7年3月 定例会",
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy/_7932.html",
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和7年3月 定例会",
      pdfUrl: "https://www.town.shiroishi.lg.jp/var/rev0/0002/7885/kaigiroku.pdf",
      pdfLabel: "3月6日",
      meetingType: "plenary",
      detailPageUrl:
        "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy/_7932.html",
    });
  });

  it("絶対URLのPDFリンクをそのまま使用する", () => {
    const html = `
      <a href="https://www.town.shiroishi.lg.jp/var/rev0/0002/7885/kaigiroku.pdf">3月6日</a>
    `;

    const result = parseMeetingPage(
      html,
      "令和7年3月 定例会",
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy/_7932.html",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.shiroishi.lg.jp/var/rev0/0002/7885/kaigiroku.pdf",
    );
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>No PDF links</p>";
    expect(
      parseMeetingPage(
        html,
        "テスト",
        "https://www.town.shiroishi.lg.jp/test.html",
      ),
    ).toEqual([]);
  });

  it("臨時会は extraordinary を返す", () => {
    const html = `
      <a href="/var/rev0/0002/7931/kaigiroku.pdf">2月3日</a>
    `;

    const result = parseMeetingPage(
      html,
      "令和7年2月 臨時会",
      "https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy/_7931.html",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });
});
