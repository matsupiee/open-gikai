import { describe, expect, it } from "vitest";
import { parseMeetingPage, parseTopPage, parseYearPage } from "./list";
import { detectMeetingType, parseDateText, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和を西暦に変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和元年第4回定例会")).toBe(2019);
  });

  it("平成を西暦に変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成31年（令和元年）")).toBe(2019);
  });

  it("年表記がない場合は null を返す", () => {
    expect(parseWarekiYear("議会議事録")).toBeNull();
  });
});

describe("parseDateText", () => {
  it("令和日付を抽出する", () => {
    expect(parseDateText("第3日 一般質問 令和6年12月9日（PDF：553KB）")).toBe(
      "2024-12-09",
    );
  });

  it("令和元年を抽出する", () => {
    expect(parseDateText("第5日 採決 令和元年12月19日（PDF:387KB）")).toBe(
      "2019-12-19",
    );
  });
});

describe("detectMeetingType", () => {
  it("会議種別を分類する", () => {
    expect(detectMeetingType("令和6年第4回定例会")).toBe("plenary");
    expect(detectMeetingType("令和6年第1回臨時会")).toBe("extraordinary");
    expect(detectMeetingType("総務産業建設常任委員会")).toBe("committee");
  });
});

describe("parseTopPage", () => {
  it("トップページから年度ページを抽出する", () => {
    const html = `
      <ul class="menu_list">
        <li><a href="./R07/index.html">令和7年</a></li>
        <li><a href="./R06/index.html">令和6年</a></li>
        <li><a href="./031/index.html">平成31年（令和元年）</a></li>
      </ul>
    `;

    const pages = parseTopPage(
      html,
      "https://www.town.chikujo.fukuoka.jp/li/020/070/040/index.html",
    );

    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual({
      title: "令和7年",
      year: 2025,
      yearPageUrl: "https://www.town.chikujo.fukuoka.jp/li/020/070/040/R07/index.html",
    });
    expect(pages[2]!.year).toBe(2019);
  });
});

describe("parseYearPage", () => {
  it("年度ページから会議ページを抽出する", () => {
    const html = `
      <ul class="menu_list">
        <li><a href="../../../../../s031/020/070/040/R06/060/gikai.html">令和6年第4回定例会</a></li>
        <li><a href="../../../../../s031/020/070/040/R06/050/R6_rinjikai_2.html">令和6年第2回臨時会</a></li>
      </ul>
    `;

    const pages = parseYearPage(
      html,
      "https://www.town.chikujo.fukuoka.jp/li/020/070/040/R06/index.html",
    );

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({
      title: "令和6年第4回定例会",
      pageUrl: "https://www.town.chikujo.fukuoka.jp/s031/020/070/040/R06/060/gikai.html",
    });
  });

  it("会議以外のリンクを除外する", () => {
    const html = `
      <a href="./index.html">令和6年</a>
      <a href="../../../../../s031/020/070/040/R06/060/gikai.html">令和6年第4回定例会</a>
      <a href="/form/inquiry/foo.html">問い合わせ</a>
    `;

    const pages = parseYearPage(
      html,
      "https://www.town.chikujo.fukuoka.jp/li/020/070/040/R06/index.html",
    );

    expect(pages).toHaveLength(1);
  });
});

describe("parseMeetingPage", () => {
  it("会議ページから日付つき PDF を抽出する", () => {
    const html = `
      <ul class="file_list">
        <li class="pdf"><a href="./061202.pdf">第1日 議案上程 令和6年12月2日（PDF：232KB）</a></li>
        <li class="pdf"><a href="./061209.pdf">第3日 一般質問 令和6年12月9日（PDF：553KB）</a></li>
      </ul>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和6年第4回定例会",
      "https://www.town.chikujo.fukuoka.jp/s031/020/070/040/R06/060/gikai.html",
    );

    expect(meetings).toHaveLength(2);
    expect(meetings[0]).toEqual({
      pdfUrl: "https://www.town.chikujo.fukuoka.jp/s031/020/070/040/R06/060/061202.pdf",
      title: "令和6年第4回定例会",
      heldOn: "2024-12-02",
      meetingType: "plenary",
      pageUrl: "https://www.town.chikujo.fukuoka.jp/s031/020/070/040/R06/060/gikai.html",
    });
  });

  it("古いページ形式の PDF も抽出する", () => {
    const html = `
      <ul>
        <li><a href="./011205.pdf">第1日 議案上程 令和元年12月5日（PDF:337KB）</a></li>
        <li><a href="./011219.pdf">第5日 採決 令和元年12月19日（PDF:387KB）</a></li>
      </ul>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和元年第4回定例会",
      "https://www.town.chikujo.fukuoka.jp/s031/020/070/040/H31/070/R1teirei04.html",
    );

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2019-12-05");
    expect(meetings[1]!.heldOn).toBe("2019-12-19");
  });

  it("日付が取れない PDF は除外する", () => {
    const html = `
      <a href="./guide.pdf">ご案内（PDF：20KB）</a>
      <a href="./061202.pdf">第1日 議案上程 令和6年12月2日（PDF：232KB）</a>
    `;

    const meetings = parseMeetingPage(
      html,
      "令和6年第4回定例会",
      "https://www.town.chikujo.fukuoka.jp/s031/020/070/040/R06/060/gikai.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("061202.pdf");
  });
});
