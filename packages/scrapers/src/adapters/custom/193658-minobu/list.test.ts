import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第4回定例会")).toBe(2024);
    expect(parseWarekiYear("令和7年第1回定例会")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第4回定例会")).toBe(2018);
    expect(parseWarekiYear("平成16年第1回定例会")).toBe(2004);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6年第4回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和6年第1回臨時会")).toBe("extraordinary");
  });
});

describe("parseListPage", () => {
  it("/uploaded/attachment/*.pdf リンクからセッション情報を抽出する", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/3028.pdf">令和6年第4回定例会</a>
        <a href="/uploaded/attachment/3029.pdf">令和6年第3回定例会</a>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和6年第4回定例会",
      year: 2024,
      pdfUrl: "https://www.town.minobu.lg.jp/uploaded/attachment/3028.pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "令和6年第3回定例会",
      year: 2024,
      pdfUrl: "https://www.town.minobu.lg.jp/uploaded/attachment/3029.pdf",
      meetingType: "plenary",
    });
  });

  it("平成の会議録も正しく抽出する", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/3108.pdf">平成16年第1回定例会</a>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("平成16年第1回定例会");
    expect(result[0]!.year).toBe(2004);
    expect(result[0]!.pdfUrl).toBe("https://www.town.minobu.lg.jp/uploaded/attachment/3108.pdf");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("会議録テキストが付いているリンクでもタイトルを正規化する", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/3026.pdf">令和7年第2回定例会会議録</a>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年第2回定例会");
  });

  it("和暦が含まれないリンクは除外する", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/9999.pdf">Adobe Reader のダウンロード</a>
        <a href="/uploaded/attachment/3028.pdf">令和6年第4回定例会</a>
      </div>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2024);
  });

  it("/uploaded/attachment/ 以外のリンクは除外する", () => {
    const html = `
      <div>
        <a href="/page/1234.html">議会トップ</a>
        <a href="https://get.adobe.com/reader/">Adobe Reader</a>
        <a href="/uploaded/attachment/3028.pdf">令和6年第4回定例会</a>
      </div>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("空のHTMLで空配列を返す", () => {
    expect(parseListPage("<p>No links here</p>")).toEqual([]);
  });

  it("複数年のデータが混在しても全て抽出する", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/3026.pdf">令和7年第2回定例会</a>
        <a href="/uploaded/attachment/3027.pdf">令和7年第1回定例会</a>
        <a href="/uploaded/attachment/3028.pdf">令和6年第4回定例会</a>
        <a href="/uploaded/attachment/3029.pdf">令和6年第3回定例会</a>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(4);
    expect(result.filter((r) => r.year === 2025)).toHaveLength(2);
    expect(result.filter((r) => r.year === 2024)).toHaveLength(2);
  });
});
