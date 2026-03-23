import { describe, expect, it } from "vitest";
import { parseIndexPage, splitByHeading, extractPdfLinks } from "./list";
import { parseHeadingYear, parseDateRange, detectMeetingType } from "./shared";

describe("parseHeadingYear", () => {
  it("令和の年を変換する", () => {
    expect(parseHeadingYear("令和7年")).toBe(2025);
    expect(parseHeadingYear("令和6年")).toBe(2024);
    expect(parseHeadingYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseHeadingYear("平成31年")).toBe(2019);
    expect(parseHeadingYear("平成30年")).toBe(2018);
    expect(parseHeadingYear("平成18年")).toBe(2006);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseHeadingYear("2024年")).toBeNull();
    expect(parseHeadingYear("")).toBeNull();
  });
});

describe("parseDateRange", () => {
  it("期間パターン（異月）を解析する", () => {
    const result = parseDateRange("第1回定例会（2月25日～3月18日）");
    expect(result).toEqual({
      startMonth: 2,
      startDay: 25,
      endMonth: 3,
      endDay: 18,
    });
  });

  it("期間パターン（同月）を解析する", () => {
    const result = parseDateRange("第1回定例会（3月1日～17日）");
    expect(result).toEqual({
      startMonth: 3,
      startDay: 1,
      endMonth: 3,
      endDay: 17,
    });
  });

  it("単日パターンを解析する", () => {
    const result = parseDateRange("第1回臨時会（2月4日）");
    expect(result).toEqual({
      startMonth: 2,
      startDay: 4,
      endMonth: null,
      endDay: null,
    });
  });

  it("日付がない場合はnullを返す", () => {
    expect(parseDateRange("会議録")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryとして分類する", () => {
    expect(detectMeetingType("第1回定例会（2月25日～3月18日）")).toBe("plenary");
  });

  it("臨時会をextraordinaryとして分類する", () => {
    expect(detectMeetingType("第1回臨時会（2月4日）")).toBe("extraordinary");
  });

  it("委員会をcommitteeとして分類する", () => {
    expect(detectMeetingType("予算決算特別委員会（3月5日～3月7日）")).toBe(
      "committee"
    );
    expect(detectMeetingType("予算特別委員会（3月12日～15日）")).toBe(
      "committee"
    );
    expect(detectMeetingType("決算特別委員会（9月16日～18日）")).toBe(
      "committee"
    );
  });
});

describe("splitByHeading", () => {
  it("h3で区切ったセクションを返す", () => {
    const html = `
      <h3>令和7年</h3>
      <ul><li>Content for R7</li></ul>
      <h3>令和6年</h3>
      <ul><li>Content for R6</li></ul>
    `;

    const sections = splitByHeading(html);

    expect(sections).toHaveLength(2);
    expect(sections[0]!.heading).toBe("令和7年");
    expect(sections[0]!.content).toContain("Content for R7");
    expect(sections[1]!.heading).toBe("令和6年");
    expect(sections[1]!.content).toContain("Content for R6");
  });

  it("h3がない場合は空配列を返す", () => {
    expect(splitByHeading("<p>No headings</p>")).toEqual([]);
  });
});

describe("extractPdfLinks", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="./cmsfiles/contents/0000000/309/R0703_T1.pdf"><img src="images/pdf.gif" alt="">第1回定例会（2月25日～3月18日） (PDF形式、5.6MB)</a></li>
        <li><a href="./cmsfiles/contents/0000000/309/R0702_R1.pdf"><img src="images/pdf.gif" alt="">第1回臨時会 （2月4日） (PDF形式、200KB)</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第1回定例会（2月25日～3月18日）",
      heldOn: "2025-02-25",
      pdfUrl: "https://www.town.ami.lg.jp/cmsfiles/contents/0000000/309/R0703_T1.pdf",
      meetingType: "plenary",
      fileName: "R0703_T1.pdf",
    });
    expect(result[1]).toEqual({
      title: "第1回臨時会（2月4日）",
      heldOn: "2025-02-04",
      pdfUrl: "https://www.town.ami.lg.jp/cmsfiles/contents/0000000/309/R0702_R1.pdf",
      meetingType: "extraordinary",
      fileName: "R0702_R1.pdf",
    });
  });

  it("特別委員会を抽出する", () => {
    const html = `
      <li><a href="./cmsfiles/contents/0000000/309/R0703_T1_toku.pdf"><img src="images/pdf.gif" alt="">予算決算特別委員会（3月5日～3月7日）(PDF形式、1.2MB)</a></li>
    `;

    const result = extractPdfLinks(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("committee");
    expect(result[0]!.title).toBe("予算決算特別委員会（3月5日～3月7日）");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>No PDF links</p>";
    expect(extractPdfLinks(html, 2025)).toEqual([]);
  });
});

describe("parseIndexPage", () => {
  it("指定年のPDFレコードのみを返す", () => {
    const html = `
      <h3>令和7年</h3>
      <h3>令和7年定例会・臨時会</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/309/R0702_R1.pdf"><img src="images/pdf.gif" alt="">第1回臨時会（2月4日）(PDF形式、200KB)</a></li>
        <li><a href="./cmsfiles/contents/0000000/309/R0703_T1.pdf"><img src="images/pdf.gif" alt="">第1回定例会（2月25日～3月18日）(PDF形式、5.6MB)</a></li>
        <li><a href="./cmsfiles/contents/0000000/309/R0703_T1_toku.pdf"><img src="images/pdf.gif" alt="">予算決算特別委員会（3月5日～3月7日）(PDF形式、1.2MB)</a></li>
      </ul>
      <h3>令和6年</h3>
      <h3>令和6年定例会・臨時会</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/309/R0602_R1.pdf"><img src="images/pdf.gif" alt="">第1回臨時会（2月13日）(PDF形式、300KB)</a></li>
        <li><a href="./cmsfiles/contents/0000000/309/R0603_T1.pdf"><img src="images/pdf.gif" alt="">第1回定例会（2月21日～3月8日）(PDF形式、4.5MB)</a></li>
      </ul>
    `;

    const result2025 = parseIndexPage(html, 2025);
    expect(result2025).toHaveLength(3);
    expect(result2025[0]!.title).toBe("第1回臨時会（2月4日）");
    expect(result2025[0]!.heldOn).toBe("2025-02-04");
    expect(result2025[0]!.meetingType).toBe("extraordinary");
    expect(result2025[1]!.title).toBe("第1回定例会（2月25日～3月18日）");
    expect(result2025[1]!.heldOn).toBe("2025-02-25");
    expect(result2025[1]!.meetingType).toBe("plenary");
    expect(result2025[2]!.title).toBe("予算決算特別委員会（3月5日～3月7日）");
    expect(result2025[2]!.meetingType).toBe("committee");

    const result2024 = parseIndexPage(html, 2024);
    expect(result2024).toHaveLength(2);
    expect(result2024[0]!.heldOn).toBe("2024-02-13");
    expect(result2024[1]!.heldOn).toBe("2024-02-21");
  });

  it("該当年がない場合は空配列を返す", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/309/R0702_R1.pdf">第1回臨時会（2月4日）(PDF形式)</a></li>
      </ul>
    `;

    expect(parseIndexPage(html, 2020)).toEqual([]);
  });

  it("平成の年度を正しく処理する", () => {
    const html = `
      <h3>平成30年</h3>
      <ul>
        <li><a href="./cmsfiles/contents/0000000/309/3003_T1.pdf">第1回定例会（3月1日～16日）(PDF形式、3MB)</a></li>
        <li><a href="./cmsfiles/contents/0000000/309/3009_T3.pdf">第3回定例会（9月7日～28日）(PDF形式、4MB)</a></li>
      </ul>
    `;

    const result = parseIndexPage(html, 2018);
    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2018-03-01");
    expect(result[1]!.heldOn).toBe("2018-09-07");
  });
});
