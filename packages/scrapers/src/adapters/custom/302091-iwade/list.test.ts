import { describe, expect, it } from "vitest";
import { parseTopPage, parseSessionPage, estimateYear } from "./list";

describe("parseTopPage", () => {
  it(".html リンクを全て抽出する", () => {
    const html = `
      <html><body>
        <h2>令和7年会議録</h2>
        <ul>
          <li><a href="R7-1.html">令和7年第1回定例会（3月議会）</a></li>
          <li><a href="R7-1-rinji.html">令和7年第1回臨時会</a></li>
        </ul>
        <h2>令和6年会議録</h2>
        <ul>
          <li><a href="2024-0612-R6-1.html">令和6年第1回定例会（3月議会）</a></li>
          <li><a href="2025-0306-1950-77.html">第4回定例会（12月）</a></li>
        </ul>
      </body></html>
    `;

    const links = parseTopPage(html);

    expect(links).toHaveLength(4);
    expect(links[0]!.href).toBe("R7-1.html");
    expect(links[0]!.text).toBe("令和7年第1回定例会（3月議会）");
    expect(links[1]!.href).toBe("R7-1-rinji.html");
    expect(links[1]!.text).toBe("令和7年第1回臨時会");
    expect(links[2]!.href).toBe("2024-0612-R6-1.html");
    expect(links[3]!.href).toBe("2025-0306-1950-77.html");
  });

  it(".html 以外のリンクはスキップする", () => {
    const html = `
      <html><body>
        <a href="index.html">トップ</a>
        <a href="files/R7-1zentai.pdf">全体分PDF</a>
        <a href="R7-1.html">令和7年第1回定例会</a>
      </body></html>
    `;

    const links = parseTopPage(html);
    expect(links).toHaveLength(2);
    expect(links[0]!.href).toBe("index.html");
    expect(links[1]!.href).toBe("R7-1.html");
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    const links = parseTopPage(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseSessionPage", () => {
  it("「全体分」を含む PDF リンクを返す", () => {
    const html = `
      <html><body>
        <h2>会議録（全体分）</h2>
        <p><a href="files/R7-1zzentai.2.pdf">会議録（全体分）</a></p>
        <h3>会議録（各日程ごと）</h3>
        <p><a href="files/R7-1-1R070228.pdf">第1日（2月28日）</a></p>
        <p><a href="files/R7-1-2R070306.2.pdf">第2日（3月6日）</a></p>
      </body></html>
    `;

    const pdfHref = parseSessionPage(html);
    expect(pdfHref).toBe("files/R7-1zzentai.2.pdf");
  });

  it("全体版がない場合は null を返す", () => {
    const html = `
      <html><body>
        <a href="files/R7-1-1R070228.pdf">第1日（2月28日）</a>
        <a href="files/R7-1-2R070306.2.pdf">第2日（3月6日）</a>
      </body></html>
    `;

    const pdfHref = parseSessionPage(html);
    expect(pdfHref).toBeNull();
  });

  it("「全体」を含む PDF リンクも対象とする", () => {
    const html = `
      <html><body>
        <a href="files/R6-4zentai.pdf">会議録（全体）</a>
      </body></html>
    `;

    const pdfHref = parseSessionPage(html);
    expect(pdfHref).toBe("files/R6-4zentai.pdf");
  });
});

describe("estimateYear", () => {
  it("令和7年 → 2025", () => {
    expect(estimateYear("令和7年第1回定例会（3月議会）", "R7-1.html")).toBe(2025);
  });

  it("令和元年 → 2019", () => {
    expect(estimateYear("令和元年第1回定例会", "R1-1.html")).toBe(2019);
  });

  it("令和6年 → 2024", () => {
    expect(estimateYear("令和6年第1回定例会（3月議会）", "2024-0612-R6-1.html")).toBe(2024);
  });

  it("平成31年 → 2019", () => {
    expect(estimateYear("平成31年第1回定例会", "2019-0301-H31-1.html")).toBe(2019);
  });

  it("href の年プレフィックスから推定する（テキストに年号なし）", () => {
    expect(estimateYear("第4回定例会（12月）", "2025-0306-1950-77.html")).toBe(2025);
  });

  it("href の令和番号から推定する", () => {
    expect(estimateYear("定例会", "R7-3.html")).toBe(2025);
  });

  it("推定不可の場合は null", () => {
    expect(estimateYear("会議録", "unknown.html")).toBeNull();
  });
});
