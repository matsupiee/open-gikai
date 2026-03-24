import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parseMeetingLinks, parsePdfLinks } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第4回12月定例会")).toBe(2024);
    expect(parseWarekiYear("令和5年第1回3月定例会")).toBe(2023);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第6回12月定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年第1回3月定例会")).toBe(2019);
    expect(parseWarekiYear("平成30年第4回12月定例会")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6年第4回12月定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和元年第4回7月臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearPageLinks", () => {
  it("年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list149-858.html">令和8年</a></li>
        <li><a href="/site/gikai/list149-829.html">令和7年</a></li>
        <li><a href="/site/gikai/list149-793.html">令和6年</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      url: "https://www.kumakogen.jp/site/gikai/list149-858.html",
      id: "858",
    });
    expect(result[1]).toEqual({
      url: "https://www.kumakogen.jp/site/gikai/list149-829.html",
      id: "829",
    });
    expect(result[2]).toEqual({
      url: "https://www.kumakogen.jp/site/gikai/list149-793.html",
      id: "793",
    });
  });

  it("重複するIDを除外する", () => {
    const html = `
      <a href="/site/gikai/list149-858.html">令和8年</a>
      <a href="/site/gikai/list149-858.html">令和8年</a>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearPageLinks(html)).toEqual([]);
  });
});

describe("parseMeetingLinks", () => {
  it("個別会議ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/23389.html">令和6年第4回12月定例会</a> / 2025年2月20日更新</li>
        <li><a href="/site/gikai/22345.html">令和6年第3回9月定例会</a> / 2024年11月15日更新</li>
      </ul>
    `;

    const result = parseMeetingLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和6年第4回12月定例会",
      url: "https://www.kumakogen.jp/site/gikai/23389.html",
      id: "23389",
    });
    expect(result[1]).toEqual({
      title: "令和6年第3回9月定例会",
      url: "https://www.kumakogen.jp/site/gikai/22345.html",
      id: "22345",
    });
  });

  it("list149形式のリンクを除外する", () => {
    const html = `
      <a href="/site/gikai/list149-858.html">令和8年</a>
      <a href="/site/gikai/23389.html">令和6年第4回12月定例会</a>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("23389");
  });

  it("重複するIDを除外する", () => {
    const html = `
      <a href="/site/gikai/23389.html">令和6年第4回12月定例会</a>
      <a href="/site/gikai/23389.html">令和6年第4回12月定例会</a>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>現在、掲載されている情報はありません。</p>";
    expect(parseMeetingLinks(html)).toEqual([]);
  });
});

describe("parsePdfLinks", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/13081.pdf">令和6年12月定例会（1日目）</a>
        <a href="/uploaded/attachment/13083.pdf">令和6年12月定例会（2日目）</a>
        <a href="/uploaded/attachment/13109.pdf">令和6年12月定例会（最終日）</a>
      </div>
    `;

    const result = parsePdfLinks(html, "令和6年第4回12月定例会", "23389");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和6年第4回12月定例会（1日目）",
      heldOn: "2024-12-01",
      pdfUrl: "https://www.kumakogen.jp/uploaded/attachment/13081.pdf",
      meetingType: "plenary",
      meetingPageId: "23389",
    });
    expect(result[1]!.title).toBe("令和6年第4回12月定例会（2日目）");
    expect(result[2]!.title).toBe("令和6年第4回12月定例会（最終日）");
  });

  it("臨時会のmeetingTypeがextraordinaryになる", () => {
    const html = `
      <a href="/uploaded/attachment/10000.pdf">令和元年7月臨時会（1日目）</a>
    `;

    const result = parsePdfLinks(html, "令和元年第4回7月臨時会", "20000");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("和暦が解析できない場合はheldOnがnullになる", () => {
    const html = `
      <a href="/uploaded/attachment/99999.pdf">会議録（1日目）</a>
    `;

    const result = parsePdfLinks(html, "Unknown Title", "11111");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBeNull();
  });

  it("重複PDFIDを除外する", () => {
    const html = `
      <a href="/uploaded/attachment/13081.pdf">令和6年12月定例会（1日目）</a>
      <a href="/uploaded/attachment/13081.pdf">令和6年12月定例会（1日目）</a>
    `;

    const result = parsePdfLinks(html, "令和6年第4回12月定例会", "23389");
    expect(result).toHaveLength(1);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録なし</p>";
    expect(parsePdfLinks(html, "令和6年第4回12月定例会", "23389")).toEqual([]);
  });
});
