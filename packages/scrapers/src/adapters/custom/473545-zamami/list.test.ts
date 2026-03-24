import { describe, expect, it } from "vitest";
import {
  parseDateFromLinkText,
  parseIssueNumber,
  parseCategoryFromSession,
  extractPdfKey,
  parseListPage,
} from "./list";

describe("parseDateFromLinkText", () => {
  it("令和7年12月16日をパースする", () => {
    expect(parseDateFromLinkText("令和7年12月16日（第1号）")).toBe("2025-12-16");
  });

  it("令和6年9月17日をパースする", () => {
    expect(parseDateFromLinkText("令和6年9月17日（第1号）一般質問")).toBe(
      "2024-09-17",
    );
  });

  it("令和元年6月3日をパースする", () => {
    expect(parseDateFromLinkText("令和元年6月3日（第1号）")).toBe("2019-06-03");
  });

  it("平成25年3月8日をパースする", () => {
    expect(parseDateFromLinkText("平成25年3月8日（第1号）")).toBe("2013-03-08");
  });

  it("全角数字をパースする", () => {
    expect(parseDateFromLinkText("令和７年１２月１６日（第１号）")).toBe(
      "2025-12-16",
    );
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromLinkText("会議録")).toBeNull();
  });
});

describe("parseIssueNumber", () => {
  it("第1号を抽出する", () => {
    expect(parseIssueNumber("令和7年12月16日（第1号）")).toBe(1);
  });

  it("第3号を抽出する", () => {
    expect(parseIssueNumber("令和7年9月18日（第3号）一般質問")).toBe(3);
  });

  it("全角数字の号を抽出する", () => {
    expect(parseIssueNumber("令和７年１２月１６日（第１号）")).toBe(1);
  });

  it("号数がない場合は null を返す", () => {
    expect(parseIssueNumber("令和7年12月16日")).toBeNull();
  });
});

describe("parseCategoryFromSession", () => {
  it("定例会を plenary として返す", () => {
    expect(parseCategoryFromSession("令和7年第4回定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary として返す", () => {
    expect(parseCategoryFromSession("令和7年第1回臨時会")).toBe("extraordinary");
  });

  it("不明なテキストは plenary として返す", () => {
    expect(parseCategoryFromSession("会議")).toBe("plenary");
  });
});

describe("extractPdfKey", () => {
  it("40桁ハッシュのPDF URLからキーを生成する", () => {
    expect(
      extractPdfKey(
        "https://www.vill.zamami.okinawa.jp/info/d96f9e12a9c9e54b48c141887748094ced5c735d.pdf",
      ),
    ).toBe("473545_d96f9e12a9c9e54b48c141887748094ced5c735d");
  });

  it("旧形式のPDF URLからキーを生成する", () => {
    expect(
      extractPdfKey(
        "https://www.vill.zamami.okinawa.jp/info/250308gijiroku.pdf",
      ),
    ).toBe("473545_250308gijiroku");
  });

  it("politics パスのPDF URLからキーを生成する", () => {
    expect(
      extractPdfKey(
        "https://www.vill.zamami.okinawa.jp/politics/240307gijiroku.pdf",
      ),
    ).toBe("473545_240307gijiroku");
  });
});

describe("parseListPage", () => {
  it("単純なPDFリンクを抽出する", () => {
    const html = `
      <html><body>
      <h4>令和7年</h4>
      <strong>令和7年第4回定例会</strong>
      <ul>
        <li><a href="/info/d96f9e12a9c9e54b48c141887748094ced5c735d.pdf">令和7年12月16日（第1号）</a></li>
        <li><a href="/info/bfab1f92ceb403efb8aa49dc92aac48b9468998a.pdf">令和7年12月17日（第2号）</a></li>
      </ul>
      </body></html>
    `;

    const meetings = parseListPage(html, null);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-12-16");
    expect(meetings[0]!.issueNumber).toBe(1);
    expect(meetings[0]!.category).toBe("plenary");
    expect(meetings[0]!.title).toBe("令和7年第4回定例会（第1号）");
    expect(meetings[1]!.heldOn).toBe("2025-12-17");
    expect(meetings[1]!.issueNumber).toBe(2);
  });

  it("一般質問リンクを含む会議を抽出する", () => {
    const html = `
      <html><body>
      <strong>令和7年第3回定例会</strong>
      <ul>
        <li><a href="/info/abc123.pdf">令和7年9月17日（第1号）一般質問</a></li>
      </ul>
      </body></html>
    `;

    const meetings = parseListPage(html, null);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年第3回定例会（第1号） 一般質問");
    expect(meetings[0]!.heldOn).toBe("2025-09-17");
  });

  it("臨時会を extraordinary として抽出する", () => {
    const html = `
      <html><body>
      <strong>令和7年第1回臨時会</strong>
      <ul>
        <li><a href="/info/abc123.pdf">令和7年1月15日（第1号）</a></li>
      </ul>
      </body></html>
    `;

    const meetings = parseListPage(html, null);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("extraordinary");
  });

  it("対象年でフィルタリングする", () => {
    const html = `
      <html><body>
      <strong>令和7年第4回定例会</strong>
      <ul>
        <li><a href="/info/abc1.pdf">令和7年12月16日（第1号）</a></li>
      </ul>
      <strong>令和6年第4回定例会</strong>
      <ul>
        <li><a href="/info/abc2.pdf">令和6年12月19日（第1号）</a></li>
      </ul>
      </body></html>
    `;

    const meetings2025 = parseListPage(html, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-12-16");

    const meetings2024 = parseListPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-19");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    expect(parseListPage(html, null)).toHaveLength(0);
  });

  it("https:// の PDF URL を正規化する", () => {
    const html = `
      <strong>令和7年第4回定例会</strong>
      <ul>
        <li><a href="https://www.vill.zamami.okinawa.jp/info/abc123.pdf">令和7年12月16日（第1号）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, null);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.zamami.okinawa.jp/info/abc123.pdf",
    );
  });
});
