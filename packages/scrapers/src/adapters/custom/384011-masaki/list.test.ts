import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parseMeetingLinks, parsePdfLinks } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("会議録　令和6（2024）年")).toBe(2024);
    expect(parseWarekiYear("令和5（2023）年12月定例会")).toBe(2023);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("会議録　令和元（2019）年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30（2018）年12月定例会")).toBe(2018);
    expect(parseWarekiYear("平成26（2014）年3月定例会")).toBe(2014);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6（2024）年12月定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和元（2019）年7月臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearPageLinks", () => {
  it("年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/list159-604.html">会議録　令和7（2025）年</a></li>
        <li><a href="/site/gikai/list159-581.html">会議録　令和6（2024）年</a></li>
        <li><a href="/site/gikai/list159-553.html">会議録　令和5（2023）年</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      url: "https://www.town.masaki.ehime.jp/site/gikai/list159-604.html",
      id: "604",
    });
    expect(result[1]).toEqual({
      url: "https://www.town.masaki.ehime.jp/site/gikai/list159-581.html",
      id: "581",
    });
    expect(result[2]).toEqual({
      url: "https://www.town.masaki.ehime.jp/site/gikai/list159-553.html",
      id: "553",
    });
  });

  it("重複するIDを除外する", () => {
    const html = `
      <a href="/site/gikai/list159-604.html">令和7年</a>
      <a href="/site/gikai/list159-604.html">令和7年</a>
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
        <li>
          <span>2025年2月21日更新</span>
          <a href="/site/gikai/31286.html">会議録（令和6（2024）年12月定例会）</a>
        </li>
        <li>
          <span>2024年11月15日更新</span>
          <a href="/site/gikai/30123.html">会議録（令和6（2024）年9月定例会）</a>
        </li>
      </ul>
    `;

    const result = parseMeetingLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "会議録（令和6（2024）年12月定例会）",
      url: "https://www.town.masaki.ehime.jp/site/gikai/31286.html",
      id: "31286",
    });
    expect(result[1]).toEqual({
      title: "会議録（令和6（2024）年9月定例会）",
      url: "https://www.town.masaki.ehime.jp/site/gikai/30123.html",
      id: "30123",
    });
  });

  it("list159形式のリンクを除外する", () => {
    const html = `
      <a href="/site/gikai/list159-581.html">令和6年</a>
      <a href="/site/gikai/31286.html">会議録（令和6（2024）年12月定例会）</a>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("31286");
  });

  it("重複するIDを除外する", () => {
    const html = `
      <a href="/site/gikai/31286.html">会議録（令和6（2024）年12月定例会）</a>
      <a href="/site/gikai/31286.html">会議録（令和6（2024）年12月定例会）</a>
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
        <a href="/uploaded/attachment/24113.pdf">
          会議録（令和7（2025）年12月定例会） [PDFファイル／592KB]
        </a>
      </div>
    `;

    const result = parsePdfLinks(html, "会議録（令和6（2024）年12月定例会）", "31286");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.masaki.ehime.jp/uploaded/attachment/24113.pdf"
    );
    expect(result[0]!.meetingPageId).toBe("31286");
    expect(result[0]!.heldOn).toBe("2024-12-01");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("臨時会のmeetingTypeがextraordinaryになる", () => {
    const html = `
      <a href="/uploaded/attachment/10000.pdf">会議録（令和元（2019）年7月臨時会） [PDFファイル／100KB]</a>
    `;

    const result = parsePdfLinks(html, "会議録（令和元（2019）年7月臨時会）", "20000");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2019-07-01");
  });

  it("和暦が解析できない場合はheldOnがnullになる", () => {
    const html = `
      <a href="/uploaded/attachment/99999.pdf">会議録 [PDFファイル／50KB]</a>
    `;

    const result = parsePdfLinks(html, "Unknown Title", "11111");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBeNull();
  });

  it("重複PDFIDを除外する", () => {
    const html = `
      <a href="/uploaded/attachment/24113.pdf">会議録（令和6（2024）年12月定例会） [PDFファイル／592KB]</a>
      <a href="/uploaded/attachment/24113.pdf">会議録（令和6（2024）年12月定例会） [PDFファイル／592KB]</a>
    `;

    const result = parsePdfLinks(html, "会議録（令和6（2024）年12月定例会）", "31286");
    expect(result).toHaveLength(1);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録なし</p>";
    expect(parsePdfLinks(html, "会議録（令和6（2024）年12月定例会）", "31286")).toEqual([]);
  });

  it("[PDFファイル...]をタイトルから除去する", () => {
    const html = `
      <a href="/uploaded/attachment/24113.pdf">会議録（令和6（2024）年12月定例会） [PDFファイル／592KB]</a>
    `;

    const result = parsePdfLinks(html, "会議録（令和6（2024）年12月定例会）", "31286");
    expect(result[0]!.title).toBe("会議録（令和6（2024）年12月定例会）");
  });
});
