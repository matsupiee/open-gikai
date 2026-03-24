import { describe, expect, it } from "vitest";
import { parseDetailPageIds, parseWarekiDate, extractPdfRecords } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年開催分")).toBe(2024);
    expect(parseWarekiYear("令和7年開催分")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年開催分")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年開催分")).toBe(2018);
    expect(parseWarekiYear("平成31年開催分")).toBe(2019);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第115回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第116回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseWarekiDate", () => {
  it("令和年月日を変換する", () => {
    expect(parseWarekiDate("令和6年3月4日")).toBe("2024-03-04");
    expect(parseWarekiDate("令和6年5月1日")).toBe("2024-05-01");
    expect(parseWarekiDate("令和7年1月15日")).toBe("2025-01-15");
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiDate("令和元年10月1日")).toBe("2019-10-01");
  });

  it("平成年月日を変換する", () => {
    expect(parseWarekiDate("平成30年12月4日")).toBe("2018-12-04");
    expect(parseWarekiDate("平成31年3月1日")).toBe("2019-03-01");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiDate("会議録一覧")).toBeNull();
    expect(parseWarekiDate("")).toBeNull();
  });
});

describe("parseDetailPageIds", () => {
  it("対象年度のIDを抽出する", () => {
    const html = `
      <a href="../info/detail.jsp?id=9544">佐用町議会会議録(令和6年開催分)</a>
      <a href="../info/detail.jsp?id=8513">佐用町議会会議録(令和5年開催分)</a>
      <a href="../info/detail.jsp?id=11060">佐用町議会会議録(令和7年開催分)</a>
    `;

    const result = parseDetailPageIds(html, 2024);
    expect(result.matched).toEqual(["9544"]);
    expect(result.total).toBe(3);
    expect(result.allIds).toEqual(["9544", "8513", "11060"]);
  });

  it("平成年度のIDを抽出する", () => {
    const html = `
      <a href="../info/detail.jsp?id=4249">会議録(平成30年開催分)</a>
      <a href="../info/detail.jsp?id=3225">会議録(平成29年開催分)</a>
    `;

    const result = parseDetailPageIds(html, 2018);
    expect(result.matched).toEqual(["4249"]);
    expect(result.total).toBe(2);
  });

  it("リンクがない場合はtotal=0を返す", () => {
    const result = parseDetailPageIds("<p>No links</p>", 2024);
    expect(result.matched).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.allIds).toEqual([]);
  });

  it("令和元年のIDを抽出する", () => {
    const html = `
      <a href="../info/detail.jsp?id=1234">会議録(令和元年開催分)</a>
    `;

    const result = parseDetailPageIds(html, 2019);
    expect(result.matched).toEqual(["1234"]);
    expect(result.total).toBe(1);
  });
});

describe("extractPdfRecords", () => {
  it("定例会のPDFリンクと日付を抽出する（テーブル形式）", () => {
    const html = `
      <table>
        <tr>
          <td>第115回定例会(1日目)</td>
          <td>令和6年3月4日</td>
          <td><a href="http://www.town.sayo.lg.jp/gikai/kaigiroku/R6nen/teirei_115/teirei115-1.pdf">(PDF形式：882KB)</a></td>
        </tr>
        <tr>
          <td>第115回定例会(2日目)</td>
          <td>令和6年3月13日</td>
          <td><a href="https://www.town.sayo.lg.jp/gikai/kaigiroku/R6nen/teirei_115/teirei115-2.pdf">(PDF形式：900KB)</a></td>
        </tr>
      </table>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id=9544"
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第115回定例会(1日目)",
      heldOn: "2024-03-04",
      pdfUrl: "http://www.town.sayo.lg.jp/gikai/kaigiroku/R6nen/teirei_115/teirei115-1.pdf",
      meetingType: "plenary",
      sessionName: "第115回定例会(1日目)",
    });
    expect(result[1]!.heldOn).toBe("2024-03-13");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <table>
        <tr>
          <td>第116回臨時会(1日目)</td>
          <td>令和6年5月1日</td>
          <td><a href="/gikai/kaigiroku/R6nen/rinji_116/rinji116-1.pdf">(PDF形式：380KB)</a></td>
        </tr>
      </table>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id=9544"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-05-01");
  });

  it("複数セッションが同一ページにある場合", () => {
    const html = `
      <table>
        <tr>
          <td>第115回定例会(1日目)</td>
          <td>令和6年3月4日</td>
          <td><a href="/gikai/kaigiroku/R6nen/teirei_115/teirei115-1.pdf">(PDF形式：882KB)</a></td>
        </tr>
        <tr>
          <td>第116回臨時会(1日目)</td>
          <td>令和6年5月1日</td>
          <td><a href="/gikai/kaigiroku/R6nen/rinji_116/rinji116-1.pdf">(PDF形式：380KB)</a></td>
        </tr>
      </table>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id=9544"
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.sessionName).toBe("第115回定例会(1日目)");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.sessionName).toBe("第116回臨時会(1日目)");
    expect(result[1]!.meetingType).toBe("extraordinary");
  });

  it("日付のない行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <td>第115回定例会(1日目)</td>
          <td>日程調整中</td>
          <td>(PDF形式：882KB)</td>
        </tr>
      </table>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id=9544"
    );

    expect(result).toEqual([]);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<table><tr><td>準備中</td></tr></table>`;

    const result = extractPdfRecords(
      html,
      "https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id=11060"
    );

    expect(result).toEqual([]);
  });

  it("相対パスのPDFリンクを絶対URLに変換する", () => {
    const html = `
      <table>
        <tr>
          <td>第115回定例会(1日目)</td>
          <td>令和6年3月4日</td>
          <td><a href="/gikai/kaigiroku/R6nen/teirei_115/teirei115-1.pdf">(PDF形式：882KB)</a></td>
        </tr>
      </table>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id=9544"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://www.town.sayo.lg.jp/gikai/kaigiroku/R6nen/teirei_115/teirei115-1.pdf");
  });

  it("平成年度のPDFリンクを処理する", () => {
    const html = `
      <table>
        <tr>
          <td>第78回定例会(1日目)</td>
          <td>平成30年12月4日</td>
          <td><a href="/gikai/kaigiroku/H30nen/teirei_078/teirei078-1.pdf">(PDF形式：700KB)</a></td>
        </tr>
      </table>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id=4249"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2018-12-04");
  });
});
