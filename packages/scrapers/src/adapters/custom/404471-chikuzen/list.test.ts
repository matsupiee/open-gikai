import { describe, expect, it } from "vitest";
import { parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("トップページから年度リンクを抽出する", () => {
    const html = `
      <div class="menu_section">
        <ul class="menu">
          <li><a href="./080/20240401151043.html">令和8年</a></li>
          <li><a href="./010/20240401151043.html">令和7年</a></li>
          <li><a href="./031/index.html">平成31年（令和元年）</a></li>
        </ul>
      </div>
    `;

    const result = parseTopPage(
      html,
      "https://www.town.chikuzen.fukuoka.jp/li/100/050/index.html",
    );

    expect(result).toEqual([
      {
        label: "令和8年",
        year: 2026,
        url: "https://www.town.chikuzen.fukuoka.jp/li/100/050/080/20240401151043.html",
      },
      {
        label: "令和7年",
        year: 2025,
        url: "https://www.town.chikuzen.fukuoka.jp/li/100/050/010/20240401151043.html",
      },
      {
        label: "平成31年（令和元年）",
        year: 2019,
        url: "https://www.town.chikuzen.fukuoka.jp/li/100/050/031/index.html",
      },
    ]);
  });
});

describe("parseYearPage", () => {
  it("年度ページから会議録ページだけを抽出する", () => {
    const html = `
      <div class="menu_section">
        <ul class="menu">
          <li><a href="../../../../S027/010/020/010/20260316160200.html">令和7年第5回臨時会会議録</a></li>
          <li><a href="../../../../S027/010/020/010/202603161550.html">令和7年第4回定例会会議録</a></li>
          <li><a href="../../../../S027/010/020/010/20250131103731.html">令和7年議決結果</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(
      html,
      "https://www.town.chikuzen.fukuoka.jp/li/100/050/010/20240401151043.html",
      2025,
    );

    expect(result).toEqual([
      {
        title: "令和7年第5回臨時会会議録",
        detailUrl:
          "https://www.town.chikuzen.fukuoka.jp/S027/010/020/010/20260316160200.html",
        year: 2025,
        meetingType: "extraordinary",
      },
      {
        title: "令和7年第4回定例会会議録",
        detailUrl:
          "https://www.town.chikuzen.fukuoka.jp/S027/010/020/010/202603161550.html",
        year: 2025,
        meetingType: "plenary",
      },
    ]);
  });
});
