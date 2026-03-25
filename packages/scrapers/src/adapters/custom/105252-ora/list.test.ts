import { describe, expect, it } from "vitest";
import { parseTopPageLinks, parseYearPage } from "./list";

describe("parseTopPageLinks", () => {
  it("トップページから年別一覧ページの URL を抽出する", () => {
    const html = `
      <div class="txtbox">
        <ul>
          <li><a href="./077/gikai-kaigiroku-R7.html">令和7年分</a></li>
          <li><a href="./006/gikai-kaigiroku-R6.html">令和6年分</a></li>
          <li><a href="./119/R5_kaigiroku.html">令和5年分</a></li>
          <li><a href="./h31/31roku.html">平成31年分</a></li>
        </ul>
      </div>
    `;

    const urls = parseTopPageLinks(html);

    expect(urls).toHaveLength(4);
    expect(urls[0]).toBe("https://www.town.ora.gunma.jp/s049/070/020/077/gikai-kaigiroku-R7.html");
    expect(urls[1]).toBe("https://www.town.ora.gunma.jp/s049/070/020/006/gikai-kaigiroku-R6.html");
    expect(urls[2]).toBe("https://www.town.ora.gunma.jp/s049/070/020/119/R5_kaigiroku.html");
    expect(urls[3]).toBe("https://www.town.ora.gunma.jp/s049/070/020/h31/31roku.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="./077/gikai-kaigiroku-R7.html">令和7年分</a></li>
        <li><a href="./077/gikai-kaigiroku-R7.html">令和7年分（重複）</a></li>
      </ul>
    `;

    const urls = parseTopPageLinks(html);
    expect(urls).toHaveLength(1);
  });

  it("HTML リンクがない場合は空配列を返す", () => {
    const html = `<div><p>コンテンツなし</p></div>`;
    const urls = parseTopPageLinks(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("令和6年の PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <html>
      <body>
        <h1>議会会議録（令和6年分）</h1>
        <div class="txtbox">
          <h2>令和6年第4回定例会（12月）</h2>
          <ul>
            <li><a href="../kaigiroku-r6-12-day1.pdf">12月10日 日程第1号（PDF：500kB）</a></li>
            <li><a href="../kaigiroku-r6-12-day2.pdf">12月11日 日程第2号（PDF：480kB）</a></li>
          </ul>
          <h2>令和6年第3回定例会（9月）</h2>
          <ul>
            <li><a href="../kaigiroku-r6-9-day1.pdf">9月10日 日程第1号（PDF：450kB）</a></li>
          </ul>
        </div>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.ora.gunma.jp/s049/070/020/006/gikai-kaigiroku-R6.html";

    const meetings = parseYearPage(html, pageUrl, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-12-10");
    expect(meetings[0]!.title).toBe("令和6年第4回定例会（12月） 日程第1号");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[1]!.heldOn).toBe("2024-12-11");
    expect(meetings[2]!.heldOn).toBe("2024-09-10");
  });

  it("臨時会を正しく処理する", () => {
    const html = `
      <html>
      <body>
        <h1>議会会議録（令和7年分）</h1>
        <div class="txtbox">
          <h2>令和7年第1回臨時会（5月）</h2>
          <ul>
            <li><a href="../kaigiroku-r7-5rinji-day1.pdf">5月15日 日程第1号（PDF：300kB）</a></li>
          </ul>
        </div>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.ora.gunma.jp/s049/070/020/077/gikai-kaigiroku-R7.html";

    const meetings = parseYearPage(html, pageUrl, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2025-05-15");
  });

  it("対象年以外のページはスキップする（h1 から年度を判定）", () => {
    const html = `
      <html>
      <body>
        <h1>議会会議録（令和5年分）</h1>
        <div class="txtbox">
          <h2>令和5年第4回定例会（12月）</h2>
          <ul>
            <li><a href="../r5-12-day1.pdf">12月5日 日程第1号（PDF：400kB）</a></li>
          </ul>
        </div>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.ora.gunma.jp/s049/070/020/119/R5_kaigiroku.html";

    const meetings = parseYearPage(html, pageUrl, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("相対パスの PDF URL を正しく解決する（../）", () => {
    const html = `
      <html>
      <body>
        <h1>議会会議録（令和6年分）</h1>
        <div class="txtbox">
          <h2>令和6年第1回定例会（3月）</h2>
          <ul>
            <li><a href="../kaigiroku-r6-3-day1.pdf">3月10日 日程第1号（PDF：400kB）</a></li>
          </ul>
        </div>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.ora.gunma.jp/s049/070/020/006/gikai-kaigiroku-R6.html";

    const meetings = parseYearPage(html, pageUrl, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ora.gunma.jp/s049/070/020/kaigiroku-r6-3-day1.pdf",
    );
  });

  it("日程番号なしのリンクも処理できる", () => {
    const html = `
      <html>
      <body>
        <h1>議会会議録（令和4年分）</h1>
        <div class="txtbox">
          <h2>令和4年第2回定例会（6月）</h2>
          <ul>
            <li><a href="../r4-6-day1.pdf">6月14日（PDF：350kB）</a></li>
          </ul>
        </div>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.ora.gunma.jp/s049/070/020/R04/R4_kaigiroku.html";

    const meetings = parseYearPage(html, pageUrl, 2022);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2022-06-14");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <html>
      <body>
        <h1>議会会議録（令和6年分）</h1>
        <div class="txtbox"><p>データなし</p></div>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.ora.gunma.jp/s049/070/020/006/gikai-kaigiroku-R6.html";

    const meetings = parseYearPage(html, pageUrl, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("平成年度の日付も正しく処理する", () => {
    const html = `
      <html>
      <body>
        <h1>議会会議録（平成30年分）</h1>
        <div class="txtbox">
          <h2>平成30年第4回定例会（12月）</h2>
          <ul>
            <li><a href="../h30-12-day1.pdf">12月11日 日程第1号（PDF：380kB）</a></li>
          </ul>
        </div>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.ora.gunma.jp/s049/070/020/h30/30roku.html";

    const meetings = parseYearPage(html, pageUrl, 2018);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-11");
  });
});
