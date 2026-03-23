import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseWarekiYear, parseDateText, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第6回定例会")).toBe(2025);
    expect(parseWarekiYear("令和6年第1回臨時会")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第4回定例会")).toBe(2018);
    expect(parseWarekiYear("平成23年第1回定例会")).toBe(2011);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("parseDateText", () => {
  it("期間形式の開催日から開始日を取得する", () => {
    expect(parseDateText("令和7年12月9日～12日")).toBe("2025-12-09");
  });

  it("単日形式の開催日を取得する", () => {
    expect(parseDateText("令和7年3月3日")).toBe("2025-03-03");
  });

  it("月またぎの期間形式でも開始日を返す", () => {
    expect(parseDateText("令和6年3月25日～4月3日")).toBe("2024-03-25");
  });

  it("平成の開催日を変換する", () => {
    expect(parseDateText("平成30年6月11日～14日")).toBe("2018-06-11");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseDateText("不明な日付")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和7年第6回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和7年第1回臨時会")).toBe("extraordinary");
  });
});

describe("parseListPage", () => {
  it("テーブルからPDFリンクと開催日を抽出する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/upload/file/gikai/H30-/kaigiroku/R7/道志村R07年12月定例会.pdf">令和7年第6回定例会会議録（PDF）</a></td>
          <td>令和7年12月9日～12日</td>
        </tr>
        <tr>
          <td><a href="/upload/file/gikai/H30-/kaigiroku/R7/道志村R07年9月定例会.pdf">令和7年第5回定例会会議録（PDF）</a></td>
          <td>令和7年9月8日～11日</td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年第6回定例会",
      heldOn: "2025-12-09",
      pdfUrl: "http://www.vill.doshi.lg.jp/upload/file/gikai/H30-/kaigiroku/R7/道志村R07年12月定例会.pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "令和7年第5回定例会",
      heldOn: "2025-09-08",
      pdfUrl: "http://www.vill.doshi.lg.jp/upload/file/gikai/H30-/kaigiroku/R7/道志村R07年9月定例会.pdf",
      meetingType: "plenary",
    });
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/upload/file/gikai/H30-/kaigiroku/R7/道志村R07年臨時会.pdf">令和7年第2回臨時会会議録（PDF）</a></td>
          <td>令和7年5月15日</td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.title).toBe("令和7年第2回臨時会");
  });

  it("例外的なPDFパスでも正しくURLを構築する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/upload/file/道志村R03年９月定例会.pdf">令和3年第5回定例会会議録（PDF）</a></td>
          <td>令和3年9月6日～9日</td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("http://www.vill.doshi.lg.jp/upload/file/道志村R03年９月定例会.pdf");
  });

  it("PDFリンクのない行を除外する", () => {
    const html = `
      <table>
        <tr>
          <td>ヘッダー</td>
          <td>会期</td>
        </tr>
        <tr>
          <td><a href="/upload/file/gikai/H30-/kaigiroku/R7/test.pdf">令和7年第6回定例会会議録（PDF）</a></td>
          <td>令和7年12月9日～12日</td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("開催日がパースできない行を除外する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/upload/file/test.pdf">令和7年第6回定例会会議録（PDF）</a></td>
          <td>不明な日付</td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);
    expect(result).toEqual([]);
  });

  it("空のHTMLで空配列を返す", () => {
    expect(parseListPage("<p>No table here</p>")).toEqual([]);
  });

  it("平成の会議録も正しく抽出する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/upload/file/gikai/H30-/kaigiroku/H30/道志村H30年6月定例会.pdf">平成30年第2回定例会会議録（PDF）</a></td>
          <td>平成30年6月11日～14日</td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("平成30年第2回定例会");
    expect(result[0]!.heldOn).toBe("2018-06-11");
  });
});
