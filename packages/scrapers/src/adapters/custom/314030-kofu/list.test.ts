import { describe, expect, it } from "vitest";
import {
  parseYearLinks,
  parseMeetingLinks,
  parsePdfLinksFromSubpage,
  parseDateFromLinkText,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年")).toBe(2024);
    expect(parseWarekiYear("令和7年")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年・令和元年")).toBe(2019);
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成22年")).toBe(2010);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第7回江府町議会12月定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第5回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearLinks", () => {
  it("年度別リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/2/1/10/2/y170/">令和7年</a></li>
        <li><a href="/2/1/10/2/p140/">令和6年</a></li>
        <li><a href="/2/1/10/2/g290/">令和5年</a></li>
      </ul>
    `;

    const result = parseYearLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ href: "/2/1/10/2/y170/", text: "令和7年" });
    expect(result[1]).toEqual({ href: "/2/1/10/2/p140/", text: "令和6年" });
    expect(result[2]).toEqual({ href: "/2/1/10/2/g290/", text: "令和5年" });
  });

  it("数字のみのIDも抽出できる（旧形式）", () => {
    const html = `
      <a href="/2/1/10/2/5/">平成27年</a>
      <a href="/2/1/10/2/1/">平成22年</a>
    `;

    const result = parseYearLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ href: "/2/1/10/2/5/", text: "平成27年" });
    expect(result[1]).toEqual({ href: "/2/1/10/2/1/", text: "平成22年" });
  });

  it("重複を除外する", () => {
    const html = `
      <a href="/2/1/10/2/y170/">令和7年</a>
      <a href="/2/1/10/2/y170/">令和7年</a>
    `;

    const result = parseYearLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseYearLinks("<p>リンクなし</p>")).toEqual([]);
  });
});

describe("parseMeetingLinks", () => {
  const yearPageUrl = "https://www.town-kofu.jp/2/1/10/2/y170/";

  it("定例会のサブページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/2/1/10/2/y170/v150/">第6回定例会</a></li>
        <li><a href="/2/1/10/2/y170/m967/">第4回定例会</a></li>
      </ul>
    `;

    const result = parseMeetingLinks(html, yearPageUrl);

    const subpages = result.filter((r) => r.subpageHref);
    expect(subpages).toHaveLength(2);
    expect(subpages[0]).toEqual({
      title: "第6回定例会",
      subpageHref: "/2/1/10/2/y170/v150/",
    });
    expect(subpages[1]).toEqual({
      title: "第4回定例会",
      subpageHref: "/2/1/10/2/y170/m967/",
    });
  });

  it("臨時会のPDF直リンクを抽出する", () => {
    const html = `
      <a href="/user/filer_public/05/09/05094fd1-7ae5-4748-b03f-e38d635880e0/rinji.pdf">第5回臨時会 5月7日</a>
    `;

    const result = parseMeetingLinks(html, yearPageUrl);

    const pdfs = result.filter((r) => r.pdfHref);
    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.title).toBe("第5回臨時会 5月7日");
    expect(pdfs[0]!.pdfHref).toBe(
      "https://www.town-kofu.jp/user/filer_public/05/09/05094fd1-7ae5-4748-b03f-e38d635880e0/rinji.pdf"
    );
  });

  it("旧形式のPDF URLも絶対URLに変換する", () => {
    const html = `
      <a href="/system/site/upload/live/540/atc_1323084387.pdf">臨時会</a>
    `;

    const result = parseMeetingLinks(html, yearPageUrl);
    const pdfs = result.filter((r) => r.pdfHref);
    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.pdfHref).toBe(
      "https://www.town-kofu.jp/system/site/upload/live/540/atc_1323084387.pdf"
    );
  });
});

describe("parsePdfLinksFromSubpage", () => {
  const subpageUrl = "https://www.town-kofu.jp/2/1/10/2/y170/v150/";

  it("日付別PDFリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/user/filer_public/aa/bb/aabbccdd/9gatsu10nichi.pdf">9月10日会議録.pdf</a></li>
        <li><a href="/user/filer_public/aa/bb/aabbccdd/9gatsu11nichi.pdf">9月11日会議録.pdf</a></li>
        <li><a href="/user/filer_public/aa/bb/aabbccdd/9gatsu25nichi.pdf">9月25日会議録.pdf</a></li>
      </ul>
    `;

    const result = parsePdfLinksFromSubpage(html, subpageUrl);

    expect(result).toHaveLength(3);
    expect(result[0]!.linkText).toBe("9月10日会議録.pdf");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town-kofu.jp/user/filer_public/aa/bb/aabbccdd/9gatsu10nichi.pdf"
    );
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>No PDF links</p>";
    expect(parsePdfLinksFromSubpage(html, subpageUrl)).toEqual([]);
  });
});

describe("parseDateFromLinkText", () => {
  it("月日を正しく抽出する", () => {
    expect(parseDateFromLinkText("9月10日会議録.pdf", 2024)).toBe("2024-09-10");
    expect(parseDateFromLinkText("12月9日会議録.pdf", 2024)).toBe("2024-12-09");
    expect(parseDateFromLinkText("3月1日会議録.pdf", 2024)).toBe("2024-03-01");
  });

  it("全角数字を正しく処理する", () => {
    expect(parseDateFromLinkText("９月１０日会議録", 2024)).toBe("2024-09-10");
  });

  it("月日を含まない場合はnullを返す", () => {
    expect(parseDateFromLinkText("会議録.pdf", 2024)).toBeNull();
    expect(parseDateFromLinkText("", 2024)).toBeNull();
  });
});
