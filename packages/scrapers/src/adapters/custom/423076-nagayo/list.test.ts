import { describe, expect, it } from "vitest";
import {
  convertWarekiToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { parseLinkText, parseListPage } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertWarekiToWesternYear", () => {
  it("令和の年を変換する", () => {
    expect(convertWarekiToWesternYear("令和6年")).toBe(2024);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertWarekiToWesternYear("令和６年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(convertWarekiToWesternYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertWarekiToWesternYear("平成30年")).toBe(2018);
    expect(convertWarekiToWesternYear("平成27年")).toBe(2015);
  });

  it("平成元年を変換する", () => {
    expect(convertWarekiToWesternYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });
});

describe("parseLinkText", () => {
  it("本会議のリンクテキストをパースする（第N号）", () => {
    const result = parseLinkText("3月4日（第1号）");
    expect(result).toEqual({
      month: 3,
      day: 4,
      label: "3月4日（第1号）",
    });
  });

  it("委員会のリンクテキストをパースする（第N日目）", () => {
    const result = parseLinkText("3月15日（第1日目）");
    expect(result).toEqual({
      month: 3,
      day: 15,
      label: "3月15日（第1日目）",
    });
  });

  it("全角数字のリンクテキストをパースする", () => {
    const result = parseLinkText("６月１０日（第２号）");
    expect(result).toEqual({
      month: 6,
      day: 10,
      label: "6月10日（第2号）",
    });
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseLinkText("議事日程")).toBeNull();
    expect(parseLinkText("PDF 493.7KB")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h2見出しとPDFリンクを抽出する（本会議）", () => {
    const html = `
      <h2>令和6年</h2>
      <h3>第1回定例会</h3>
      <a href="/gikai/kiji0031007/3_1007_12345_R06_03_04.pdf">3月4日（第1号）</a>
    `;

    const result = parseListPage(html, "本会議");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "第1回定例会 3月4日（第1号）",
      pdfUrl: "https://webtown.nagayo.jp/gikai/kiji0031007/3_1007_12345_R06_03_04.pdf",
      meetingType: "plenary",
      headingYear: 2024,
      heldOn: "2024-03-04",
      meetingCategory: "本会議",
    });
  });

  it("委員会のリンクテキストをパースする（第N日目）", () => {
    const html = `
      <h2>令和6年</h2>
      <h3>第1回定例会</h3>
      <a href="/gikai/kiji0032948/3_2948_12345.pdf">3月15日（第1日目）</a>
    `;

    const result = parseListPage(html, "総務厚生常任委員会");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例会 3月15日（第1日目）");
    expect(result[0]!.heldOn).toBe("2024-03-15");
    expect(result[0]!.meetingCategory).toBe("総務厚生常任委員会");
  });

  it("臨時会をextraordinaryと判定する", () => {
    const html = `
      <h2>令和6年</h2>
      <h3>第1回臨時会</h3>
      <a href="/gikai/kiji0031007/3_1007_99999.pdf">1月29日（第1号）</a>
    `;

    const result = parseListPage(html, "本会議");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("複数年度・複数リンクを正しく紐付ける", () => {
    const html = `
      <h2>令和6年</h2>
      <h3>第4回定例会</h3>
      <a href="/gikai/kiji0031007/3_1007_30636_up_abc12345.pdf">12月10日（第4号）</a>
      <h3>第1回臨時会</h3>
      <a href="/gikai/kiji0031007/3_1007_11111.pdf">1月29日（第1号）</a>
      <h2>令和5年</h2>
      <h3>第1回定例会</h3>
      <a href="/gikai/kiji0031007/3_1007_22222.pdf">3月6日（第1号）</a>
    `;

    const result = parseListPage(html, "本会議");

    expect(result).toHaveLength(3);
    expect(result[0]!.headingYear).toBe(2024);
    expect(result[0]!.title).toBe("第4回定例会 12月10日（第4号）");
    expect(result[0]!.heldOn).toBe("2024-12-10");
    expect(result[1]!.meetingType).toBe("extraordinary");
    expect(result[2]!.headingYear).toBe(2023);
    expect(result[2]!.heldOn).toBe("2023-03-06");
  });

  it("PDF以外のリンクを除外する", () => {
    const html = `
      <h2>令和6年</h2>
      <h3>第1回定例会</h3>
      <a href="/gikai/kiji0031007/index.html">詳細ページ</a>
      <a href="/gikai/kiji0031007/3_1007_12345.pdf">3月4日（第1号）</a>
    `;

    const result = parseListPage(html, "本会議");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain(".pdf");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html, "本会議")).toEqual([]);
  });

  it("平成の年度見出しを正しく処理する", () => {
    const html = `
      <h2>平成27年</h2>
      <h3>第1回定例会</h3>
      <a href="/gikai/kiji0031007/3_1007_10000.pdf">3月5日（第1号）</a>
    `;

    const result = parseListPage(html, "本会議");

    expect(result).toHaveLength(1);
    expect(result[0]!.headingYear).toBe(2015);
    expect(result[0]!.heldOn).toBe("2015-03-05");
  });
});
