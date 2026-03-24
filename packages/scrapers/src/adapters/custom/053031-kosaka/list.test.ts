import { describe, expect, it } from "vitest";
import {
  parseYearPageUrls,
  matchesYear,
  parseMeetingLinks,
  extractPdfRecords,
} from "./list";

describe("matchesYear", () => {
  it("令和6年 → 2024", () => {
    expect(matchesYear("令和6年会議録", 2024)).toBe(true);
  });

  it("令和7年 → 2025", () => {
    expect(matchesYear("令和7年会議録", 2025)).toBe(true);
  });

  it("平成29年 → 2017", () => {
    expect(matchesYear("平成29年会議録", 2017)).toBe(true);
  });

  it("平成31年・令和元年 → 2019（平成31年側）", () => {
    expect(matchesYear("平成31年・令和元年会議録", 2019)).toBe(true);
  });

  it("一致しない年は false", () => {
    expect(matchesYear("令和6年会議録", 2023)).toBe(false);
  });
});

describe("parseYearPageUrls", () => {
  it("トップページから対象年度の URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/1/index.html">平成29年会議録</a></li>
        <li><a href="https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/2/index.html">平成30年会議録</a></li>
        <li><a href="https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/1223.html">平成31年・令和元年会議録</a></li>
        <li><a href="https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/2607.html">令和6年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/2607.html"
    );
  });

  it("平成31年・令和元年ページは 2019 にマッチする", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/1223.html">平成31年・令和元年会議録</a></li>
        <li><a href="https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/2607.html">令和6年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html, 2019);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/1223.html"
    );
  });

  it("対応する年度がない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/kaigiroku/2607.html">令和6年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html, 2023);
    expect(result).toHaveLength(0);
  });

  it("プロトコル相対 URL を https: に変換する", () => {
    const html = `
      <ul>
        <li><a href="//www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/2607.html">令和6年会議録</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html, 2024);
    expect(result[0]).toBe(
      "https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/2607.html"
    );
  });
});

describe("parseMeetingLinks", () => {
  it("「小坂町議会」を含むリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html">令和6年第1回小坂町議会（定例会）</a></li>
        <li><a href="https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2546.html">令和6年第2回小坂町議会（臨時会）</a></li>
        <li><a href="/other-link.html">関係ないリンク</a></li>
      </ul>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和6年第1回小坂町議会（定例会）",
      url: "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html",
    });
    expect(result[1]).toEqual({
      title: "令和6年第2回小坂町議会（臨時会）",
      url: "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2546.html",
    });
  });

  it("重複する URL を除外する", () => {
    const html = `
      <a href="https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html">令和6年第1回小坂町議会（定例会）</a>
      <a href="https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html">令和6年第1回小坂町議会（定例会）（重複）</a>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(1);
  });

  it("「小坂町議会」を含まないリンクは除外する", () => {
    const html = `
      <a href="/some-page.html">令和6年度予算</a>
      <a href="/another-page.html">議会だより</a>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(0);
  });
});

describe("extractPdfRecords", () => {
  it("定例会の複数 PDF を抽出する", () => {
    const html = `
      <ul>
        <li>・<a href="//www.town.kosaka.akita.jp/material/files/group/5/R6-1syoniti.pdf">初日（2月20日）(PDFファイル:692.3KB)</a></li>
        <li>・<a href="//www.town.kosaka.akita.jp/material/files/group/5/R6-1ippannsitumonn.pdf">一般質問（2月21日）(PDFファイル:570.1KB)</a></li>
        <li>・<a href="//www.town.kosaka.akita.jp/material/files/group/5/R6-1saisyuubi.pdf">最終日（2月29日）(PDFファイル:489.4KB)</a></li>
      </ul>
    `;

    const detailUrl = "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2545.html";
    const result = extractPdfRecords(html, "令和6年第1回小坂町議会（定例会）", detailUrl);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和6年第1回小坂町議会（定例会） 初日（2月20日）");
    expect(result[0]!.heldOn).toBe("2024-02-20");
    expect(result[0]!.pdfUrl).toBe("https://www.town.kosaka.akita.jp/material/files/group/5/R6-1syoniti.pdf");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.detailUrl).toBe(detailUrl);
    expect(result[0]!.pdfLabel).toBe("初日（2月20日）");

    expect(result[1]!.heldOn).toBe("2024-02-21");
    expect(result[2]!.heldOn).toBe("2024-02-29");
  });

  it("臨時会の単一 PDF を抽出する", () => {
    const html = `
      <li>・<a href="//www.town.kosaka.akita.jp/material/files/group/5/R605rinnjikai.pdf">7月29日(PDFファイル:225KB)</a></li>
    `;

    const detailUrl = "https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/31gannenkaigiroku_5/2549.html";
    const result = extractPdfRecords(html, "令和6年第5回小坂町議会（臨時会）", detailUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第5回小坂町議会（臨時会） 7月29日");
    expect(result[0]!.heldOn).toBe("2024-07-29");
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("平成29年の連番形式 PDF を抽出する", () => {
    const html = `
      <li><a href="//www.town.kosaka.akita.jp/material/files/group/5/7888download.pdf">初日（12月12日）(PDFファイル:586.36KB)</a></li>
      <li><a href="//www.town.kosaka.akita.jp/material/files/group/5/7889download.pdf">一般質問（12月13日）(PDFファイル:703.29KB)</a></li>
      <li><a href="//www.town.kosaka.akita.jp/material/files/group/5/7890download.pdf">最終日（12月19日）(PDFファイル:344.34KB)</a></li>
    `;

    const detailUrl = "https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/1/818.html";
    const result = extractPdfRecords(html, "平成29年第8回（12月）小坂町議会（定例会）", detailUrl);

    expect(result).toHaveLength(3);
    expect(result[0]!.heldOn).toBe("2017-12-12");
    expect(result[1]!.heldOn).toBe("2017-12-13");
    expect(result[2]!.heldOn).toBe("2017-12-19");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div>会議録は準備中です</div>`;
    const result = extractPdfRecords(html, "令和7年第3回小坂町議会（臨時会）", "https://example.com/detail");
    expect(result).toHaveLength(0);
  });

  it("日付が解析できない PDF の heldOn は null", () => {
    const html = `
      <li><a href="//www.town.kosaka.akita.jp/material/files/group/5/R0702teireikaiippannshitsumonn.pdf">一般質問(PDFファイル:500KB)</a></li>
    `;

    const result = extractPdfRecords(html, "令和7年第2回小坂町議会（定例会）", "https://example.com/detail");
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBeNull();
  });
});
