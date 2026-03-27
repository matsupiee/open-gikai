import { describe, expect, it } from "vitest";
import {
  parseIndexPage,
  parseMeetingLinks,
  parseSessionFrameset,
  parseYearPageLinks,
} from "./list";

describe("parseYearPageLinks", () => {
  it("トップページから年度別ページと西暦年を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/26042.html">令和7年（2025年）会議録</a></li>
        <li><a href="/site/gikai/23143.html">令和6年（2024年）会議録</a></li>
        <li><a href="/site/gikai/7024.html">令和元年（2019年）会議録</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和7年（2025年）会議録",
      url: "https://www.city.hachimantai.lg.jp/site/gikai/26042.html",
      year: 2025,
    });
    expect(result[1]).toEqual({
      title: "令和6年（2024年）会議録",
      url: "https://www.city.hachimantai.lg.jp/site/gikai/23143.html",
      year: 2024,
    });
    expect(result[2]).toEqual({
      title: "令和元年（2019年）会議録",
      url: "https://www.city.hachimantai.lg.jp/site/gikai/7024.html",
      year: 2019,
    });
  });

  it("重複したリンクは1件にまとめる", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/23143.html">令和6年（2024年）会議録</a></li>
        <li><a href="/site/gikai/23143.html">令和6年（2024年）会議録</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2024);
  });
});

describe("parseMeetingLinks", () => {
  it("年度別ページから会議ごとの frameset リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/shigikai/kaigiroku/r06/r0603t.html" target="_self">第1回（3月）定例会</a></li>
        <li><a href="/shigikai/kaigiroku/r06/r0603y.html" target="_self">予算特別委員会</a></li>
        <li><a href="/site/gikai/6580.html">議長就任あいさつ</a></li>
      </ul>
    `;

    const result = parseMeetingLinks(
      html,
      "https://www.city.hachimantai.lg.jp/site/gikai/23143.html",
    );

    expect(result).toEqual([
      {
        title: "第1回（3月）定例会",
        url: "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603t.html",
      },
      {
        title: "予算特別委員会",
        url: "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603y.html",
      },
    ]);
  });
});

describe("parseSessionFrameset", () => {
  it("frameset HTML から会議タイトルと index URL を抽出する", () => {
    const html = `
      <html>
        <head>
          <title>令和６年八幡平市議会第１回定例会</title>
        </head>
        <frameset cols="300,*">
          <frame name="index" src="r0603t_index.html">
          <frame name="main" src="r060220.html">
        </frameset>
      </html>
    `;

    const result = parseSessionFrameset(
      html,
      "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603t.html",
    );

    expect(result).toEqual({
      sessionTitle: "令和6年八幡平市議会第1回定例会",
      indexUrl:
        "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603t_index.html",
    });
  });
});

describe("parseIndexPage", () => {
  it("目次ページから日別本文 HTML を抽出する", () => {
    const html = `
      <html>
        <body>
          <a href="r060220.html" target="main">第　１　号　（２月２０日）</a><br>
          <a href="r060220.html#0001" target="main">議事日程</a><br>
          <a href="r060305.html" target="main">第　２　号　（３月５日）</a><br>
          <a href="r060305.html#0001" target="main">議事日程</a><br>
        </body>
      </html>
    `;

    const result = parseIndexPage(
      html,
      "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603t_index.html",
      "令和6年八幡平市議会第1回定例会",
      2024,
    );

    expect(result).toEqual([
      {
        title: "令和6年八幡平市議会第1回定例会 第1号（2月20日）",
        heldOn: "2024-02-20",
        mainUrl:
          "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r060220.html",
        meetingType: "plenary",
      },
      {
        title: "令和6年八幡平市議会第1回定例会 第2号（3月5日）",
        heldOn: "2024-03-05",
        mainUrl:
          "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r060305.html",
        meetingType: "plenary",
      },
    ]);
  });

  it("委員会の目次ページも抽出できる", () => {
    const html = `
      <html>
        <body>
          <a href="r0603y01.html" target="main">第　１　号　（３月１１日）</a><br>
          <a href="r0603y01.html#0001" target="main">会議次第</a><br>
          <a href="r0603y02.html" target="main">第　２　号　（３月１２日）</a><br>
        </body>
      </html>
    `;

    const result = parseIndexPage(
      html,
      "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603y_index.html",
      "令和6年第1回八幡平市予算特別委員会会議",
      2024,
    );

    expect(result).toEqual([
      {
        title: "令和6年第1回八幡平市予算特別委員会会議 第1号（3月11日）",
        heldOn: "2024-03-11",
        mainUrl:
          "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603y01.html",
        meetingType: "committee",
      },
      {
        title: "令和6年第1回八幡平市予算特別委員会会議 第2号（3月12日）",
        heldOn: "2024-03-12",
        mainUrl:
          "https://www.city.hachimantai.lg.jp/shigikai/kaigiroku/r06/r0603y02.html",
        meetingType: "committee",
      },
    ]);
  });
});
