import { describe, it, expect } from "vitest";
import { parseYearPage } from "./list";
import { extractYearFromTitle, extractMonthFromTitle, estimateHeldOn } from "./shared";

describe("parseYearPage", () => {
  it("年度別ページから PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploaded/attachment/123456.pdf">令和6年第1回臨時会（1月）</a>
        </li>
        <li>
          <a href="/uploaded/attachment/123457.pdf">令和6年第1回定例会（3月）（1）</a>
        </li>
        <li>
          <a href="/uploaded/attachment/123458.pdf">令和6年第1回定例会（3月）（2）</a>
        </li>
      </ul>
    `;

    const results = parseYearPage(html, 2024);

    expect(results).toHaveLength(3);
    expect(results[0]!.attachmentId).toBe("123456");
    expect(results[0]!.title).toBe("令和6年第1回臨時会（1月）");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.kumamoto-takamori.lg.jp/uploaded/attachment/123456.pdf"
    );
    expect(results[1]!.attachmentId).toBe("123457");
    expect(results[1]!.title).toBe("令和6年第1回定例会（3月）（1）");
    expect(results[2]!.attachmentId).toBe("123458");
    expect(results[2]!.title).toBe("令和6年第1回定例会（3月）（2）");
  });

  it("重複する attachmentId は除外する", () => {
    const html = `
      <a href="/uploaded/attachment/123456.pdf">令和6年第1回臨時会（1月）</a>
      <a href="/uploaded/attachment/123456.pdf">令和6年第1回臨時会（1月）（再掲）</a>
    `;

    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクも処理する", () => {
    const html = `
      <a href="https://www.town.kumamoto-takamori.lg.jp/uploaded/attachment/999999.pdf">令和6年第4回定例会（12月）</a>
    `;

    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(1);
    expect(results[0]!.attachmentId).toBe("999999");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.kumamoto-takamori.lg.jp/uploaded/attachment/999999.pdf"
    );
  });

  it("他の PDF リンク（attachment 形式でないもの）は除外する", () => {
    const html = `
      <a href="/uploaded/attachment/123456.pdf">令和6年第1回臨時会（1月）</a>
      <a href="/other/path/document.pdf">その他の資料</a>
    `;

    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(1);
    expect(results[0]!.attachmentId).toBe("123456");
  });
});

describe("extractYearFromTitle", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromTitle("令和6年第1回臨時会（1月）")).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    expect(extractYearFromTitle("令和元年第1回定例会（3月）")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromTitle("平成30年第4回定例会（12月）")).toBe(2018);
  });

  it("全角数字を正しく変換する", () => {
    expect(extractYearFromTitle("令和４年第２回臨時会（２月）")).toBe(2022);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});

describe("extractMonthFromTitle", () => {
  it("（月）パターンから月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年第1回臨時会（1月）")).toBe(1);
  });

  it("複数の（）がある場合は最初の月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年第1回定例会（3月）（1）")).toBe(3);
  });

  it("12月を正しく抽出する", () => {
    expect(extractMonthFromTitle("令和6年第4回定例会（12月）（3）")).toBe(12);
  });

  it("月がない場合は null を返す", () => {
    expect(extractMonthFromTitle("令和6年会議録")).toBeNull();
  });
});

describe("estimateHeldOn", () => {
  it("年と月から月初の日付を返す", () => {
    expect(estimateHeldOn(2024, 3)).toBe("2024-03-01");
  });

  it("1桁の月を2桁でゼロ埋めする", () => {
    expect(estimateHeldOn(2024, 1)).toBe("2024-01-01");
  });

  it("12月を正しく返す", () => {
    expect(estimateHeldOn(2024, 12)).toBe("2024-12-01");
  });
});
