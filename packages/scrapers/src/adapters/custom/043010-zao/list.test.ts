import { describe, expect, it } from "vitest";
import {
  parseYearPageLinks,
  parseMeetingsFromYearPage,
} from "./list";

describe("parseYearPageLinks", () => {
  it("令和年度ページのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_R7.html">令和7年</a></li>
          <li><a href="/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_R6.html">令和6年</a></li>
          <li><a href="/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_R1.html">令和元年</a></li>
        </ul>
      </body>
      </html>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.url).toBe(
      "https://www.town.zao.miyagi.jp/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_R7.html",
    );
    expect(links[0]!.year).toBe(2025);
    expect(links[1]!.year).toBe(2024);
    expect(links[2]!.year).toBe(2019);
  });

  it("平成年度ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_h31.html">平成31年</a></li>
        <li><a href="/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_h23.html">平成23年</a></li>
      </ul>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0]!.year).toBe(2019);
    expect(links[1]!.year).toBe(2011);
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_R7.html">令和7年</a></li>
        <li><a href="/kurashi_guide/gikai_senkyo/gikai/gijiroku/gijiroku_R7.html">令和7年（再掲）</a></li>
      </ul>
    `;

    const links = parseYearPageLinks(html);
    expect(links).toHaveLength(1);
  });

  it("年度ページリンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const links = parseYearPageLinks(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseMeetingsFromYearPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <html>
      <body>
        <p>7月会議</p>
        <ul>
          <li><a href="gijiroku_R7.files/r070702.pdf">会議録（7月2日）</a></li>
          <li><a href="gijiroku_R7.files/r070703.pdf">会議録（7月3日）</a></li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseMeetingsFromYearPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.type).toBe("pdf");
    if (meetings[0]!.type === "pdf") {
      expect(meetings[0]!.heldOn).toBe("2025-07-02");
      expect(meetings[0]!.pdfUrl).toContain("r070702.pdf");
    }
    if (meetings[1]!.type === "pdf") {
      expect(meetings[1]!.heldOn).toBe("2025-07-03");
    }
  });

  it("HTML フレームセットリンクを正しく抽出する", () => {
    const html = `
      <html>
      <body>
        <p>6月会議</p>
        <ul>
          <li><a href="/gijiroku/gijiroku/R0606-2/R0606-2main.html">会議録（6月11日）</a></li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseMeetingsFromYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.type).toBe("html");
    if (meetings[0]!.type === "html") {
      expect(meetings[0]!.mainUrl).toContain("R0606-2main.html");
    }
  });

  it("指定年以外の PDF をスキップする", () => {
    const html = `
      <ul>
        <li><a href="gijiroku_R7.files/r070702.pdf">会議録（7月2日）</a></li>
      </ul>
    `;

    const meetings = parseMeetingsFromYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録なし</p></body></html>`;
    const meetings = parseMeetingsFromYearPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });
});
