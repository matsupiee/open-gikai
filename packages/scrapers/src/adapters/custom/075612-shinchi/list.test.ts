import { describe, it, expect } from "vitest";
import { parsePdfLinks } from "./list";
import {
  parseJapaneseDate,
  extractYearFromTitle,
  westernYearToYearCode,
  yearCodeToWesternYear,
} from "./shared";

describe("parsePdfLinks", () => {
  it("年度別一覧ページから PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <a href="pdf/R0600/R06.12T.pdf">令和６年第７回定例会会議録</a>
        <a href="pdf/R0600/R06.07R.pdf">令和６年第１回臨時会会議録</a>
      </body>
      </html>
    `;

    const results = parsePdfLinks(html, "R0600");

    expect(results).toHaveLength(2);
    expect(results[0]!.pdfUrl).toBe("http://shinchi-k.k-quick.net/pdf/R0600/R06.12T.pdf");
    expect(results[0]!.title).toBe("令和６年第７回定例会会議録");
    expect(results[0]!.yearCode).toBe("R0600");
    expect(results[0]!.fileName).toBe("R06.12T.pdf");
    expect(results[1]!.pdfUrl).toBe("http://shinchi-k.k-quick.net/pdf/R0600/R06.07R.pdf");
    expect(results[1]!.title).toBe("令和６年第１回臨時会会議録");
  });

  it("pdf/ で始まらないリンクは無視する", () => {
    const html = `
      <a href="index.html">トップページ</a>
      <a href="pdf/manual.pdf">利用マニュアル</a>
      <a href="pdf/R0600/R06.12T.pdf">令和６年第７回定例会会議録</a>
    `;

    const results = parsePdfLinks(html, "R0600");

    // manual.pdf は pdf/ で始まるが年度コードが含まれないため取得される
    // ただし index.html はスキップされる
    expect(results.some((r) => r.pdfUrl.includes("R06.12T.pdf"))).toBe(true);
    expect(results.some((r) => r.pdfUrl.includes("index.html"))).toBe(false);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parsePdfLinks(html, "R0600");
    expect(results).toHaveLength(0);
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <a href="pdf/R0600/R06.12T.pdf">令和６年第７回定例会会議録</a>
      <a href="pdf/R0600/R06.12T.pdf">令和６年第７回定例会会議録（再掲）</a>
    `;

    const results = parsePdfLinks(html, "R0600");
    expect(results).toHaveLength(1);
  });

  it("平成年度の PDF リンクも正しく抽出する", () => {
    const html = `
      <a href="pdf/H2700/H27.01R.pdf">平成２７年第１回臨時会会議録</a>
      <a href="pdf/H2700/H27.06T.pdf">平成２７年第３回定例会会議録</a>
    `;

    const results = parsePdfLinks(html, "H2700");

    expect(results).toHaveLength(2);
    expect(results[0]!.pdfUrl).toBe("http://shinchi-k.k-quick.net/pdf/H2700/H27.01R.pdf");
    expect(results[0]!.yearCode).toBe("H2700");
    expect(results[0]!.fileName).toBe("H27.01R.pdf");
  });
});

describe("westernYearToYearCode", () => {
  it("令和年度のコードを生成する", () => {
    expect(westernYearToYearCode(2024)).toBe("R0600");
    expect(westernYearToYearCode(2019)).toBe("R0100");
    expect(westernYearToYearCode(2025)).toBe("R0700");
  });

  it("平成年度のコードを生成する", () => {
    expect(westernYearToYearCode(2015)).toBe("H2700");
    expect(westernYearToYearCode(2018)).toBe("H3000");
    expect(westernYearToYearCode(2019)).toBe("R0100");
  });

  it("古すぎる年度は null を返す", () => {
    expect(westernYearToYearCode(1988)).toBeNull();
  });
});

describe("yearCodeToWesternYear", () => {
  it("令和コードを西暦に変換する", () => {
    expect(yearCodeToWesternYear("R0600")).toBe(2024);
    expect(yearCodeToWesternYear("R0100")).toBe(2019);
    expect(yearCodeToWesternYear("R0700")).toBe(2025);
  });

  it("平成コードを西暦に変換する", () => {
    expect(yearCodeToWesternYear("H2700")).toBe(2015);
    expect(yearCodeToWesternYear("H3100")).toBe(2019);
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和６年第７回定例会会議録")).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年第１回定例会会議録")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成２７年第１回定例会会議録")).toBe(2015);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("parseJapaneseDate", () => {
  it("令和の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和6年12月6日")).toBe("2024-12-06");
  });

  it("全角数字の日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和６年１２月６日（金曜日）")).toBe("2024-12-06");
  });

  it("平成の日付を正しく変換する", () => {
    expect(parseJapaneseDate("平成２７年３月１日（日曜日）")).toBe("2015-03-01");
  });

  it("令和元年を正しく変換する", () => {
    expect(parseJapaneseDate("令和元年６月１日（土曜日）")).toBe("2019-06-01");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseJapaneseDate("日付情報なし")).toBeNull();
  });
});
