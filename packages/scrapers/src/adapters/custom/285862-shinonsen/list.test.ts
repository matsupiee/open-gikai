import { describe, expect, it } from "vitest";
import { parseTopPageIds, extractPdfRecords } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年会議録")).toBe(2025);
    expect(parseWarekiYear("令和6年会議録")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年会議録")).toBe(2018);
  });

  it("平成31年・令和元年の文字列は令和元年を先に検出する", () => {
    // "平成31年・令和元年" という文字列は令和パターンが先にマッチする
    expect(parseWarekiYear("平成31年・令和元年会議録")).toBe(2019);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第135回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第133回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseTopPageIds", () => {
  it("トップページから年度別ページIDを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/page/?mode=detail&amp;page_id=1f8d048596a66797df1d173524b96774">令和7年会議録</a></li>
        <li><a href="/page/?mode=detail&amp;page_id=af9ab8aa1dea47aa7384e22d170bf14e">令和6年会議録</a></li>
      </ul>
    `;

    const result = parseTopPageIds(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pageId: "1f8d048596a66797df1d173524b96774",
      yearText: "令和7年会議録",
    });
    expect(result[1]).toEqual({
      pageId: "af9ab8aa1dea47aa7384e22d170bf14e",
      yearText: "令和6年会議録",
    });
  });

  it("重複するIDを除外する", () => {
    const html = `
      <a href="/page/?mode=detail&amp;page_id=1f8d048596a66797df1d173524b96774">令和7年会議録</a>
      <a href="/page/?mode=detail&amp;page_id=1f8d048596a66797df1d173524b96774">令和7年会議録</a>
    `;

    const result = parseTopPageIds(html);
    expect(result).toHaveLength(1);
  });

  it("ページIDがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseTopPageIds(html)).toEqual([]);
  });
});

describe("extractPdfRecords", () => {
  it("PDFリンクから会議セッション情報を抽出する", () => {
    const html = `
      <h3>第135回定例会</h3>
      <ul>
        <li><a href="/uppdf/1741615200.pdf">令和7年3月10日 第135回定例会 1日目 (450KB)</a></li>
        <li><a href="/uppdf/1741875600.pdf">令和7年3月14日 第135回定例会 2日目 (520KB)</a></li>
      </ul>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.shinonsen.hyogo.jp/page/?mode=detail&page_id=1f8d048596a66797df1d173524b96774",
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第135回定例会 令和7年3月10日 第135回定例会 1日目",
      heldOn: "2025-03-10",
      pdfUrl: "https://www.town.shinonsen.hyogo.jp/uppdf/1741615200.pdf",
      meetingType: "plenary",
      sessionName: "第135回定例会",
    });
    expect(result[1]!.heldOn).toBe("2025-03-14");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <h3>第133回臨時会</h3>
      <ul>
        <li><a href="/uppdf/1741615200.pdf">令和7年2月5日 第133回臨時会 (300KB)</a></li>
      </ul>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.shinonsen.hyogo.jp/page/?mode=detail&page_id=1f8d048596a66797df1d173524b96774",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2025-02-05");
  });

  it("平成年度のPDFリンクを処理する", () => {
    const html = `
      <h3>第100回定例会</h3>
      <ul>
        <li><a href="/uppdf/1543804800.pdf">平成30年12月3日 第100回定例会 1日目 (380KB)</a></li>
      </ul>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.shinonsen.hyogo.jp/page/?mode=detail&page_id=a6b34f6baad340b69552dcafb7acdda2",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2018-12-03");
  });

  it("令和元年のPDFリンクを処理する", () => {
    const html = `
      <h3>第105回定例会</h3>
      <ul>
        <li><a href="/uppdf/1568073600.pdf">令和元年9月10日 第105回定例会 1日目 (400KB)</a></li>
      </ul>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.shinonsen.hyogo.jp/page/?mode=detail&page_id=d85d4755d33ed6da569e81d517f8934d",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2019-09-10");
  });

  it("日付を含まないリンクを除外する", () => {
    const html = `
      <h3>第135回定例会</h3>
      <ul>
        <li><a href="/uppdf/1741615200.pdf">令和7年3月10日 第135回定例会 1日目 (450KB)</a></li>
        <li><a href="/other/schedule.pdf">議事日程</a></li>
      </ul>
    `;

    // /uppdf/*.pdf のみ対象なので議事日程リンクは無視される
    const result = extractPdfRecords(
      html,
      "https://www.town.shinonsen.hyogo.jp/page/?mode=detail&page_id=1f8d048596a66797df1d173524b96774",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-03-10");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<h3>第135回定例会</h3><p>準備中</p>`;

    const result = extractPdfRecords(
      html,
      "https://www.town.shinonsen.hyogo.jp/page/?mode=detail&page_id=1f8d048596a66797df1d173524b96774",
    );

    expect(result).toEqual([]);
  });

  it("複数セッションが同一ページにある場合", () => {
    const html = `
      <h3>第135回定例会</h3>
      <ul>
        <li><a href="/uppdf/1741615200.pdf">令和7年3月10日 第135回定例会 1日目 (450KB)</a></li>
      </ul>
      <h3>第133回臨時会</h3>
      <ul>
        <li><a href="/uppdf/1737950400.pdf">令和7年1月27日 第133回臨時会 (300KB)</a></li>
      </ul>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.shinonsen.hyogo.jp/page/?mode=detail&page_id=1f8d048596a66797df1d173524b96774",
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.sessionName).toBe("第135回定例会");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.sessionName).toBe("第133回臨時会");
    expect(result[1]!.meetingType).toBe("extraordinary");
  });
});
