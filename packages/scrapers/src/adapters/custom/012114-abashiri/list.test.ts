import { describe, expect, it } from "vitest";
import { parsePlenaryPage, parseCommitteePage, parseDateFromText, parseListPage } from "./list";

describe("parseDateFromText", () => {
  it("令和の年月日をパースする", () => {
    expect(parseDateFromText("令和7年10月31日")).toBe("2025-10-31");
  });

  it("令和の年月（日なし）をパースする", () => {
    expect(parseDateFromText("令和7年9月")).toBe("2025-09-01");
  });

  it("平成の年月日をパースする", () => {
    expect(parseDateFromText("平成31年3月15日")).toBe("2019-03-15");
  });

  it("令和元年をパースする", () => {
    expect(parseDateFromText("令和元年6月")).toBe("2019-06-01");
  });

  it("日付がない場合は空文字を返す", () => {
    expect(parseDateFromText("資料一覧")).toBe("");
  });
});

describe("parsePlenaryPage", () => {
  it("定例会の PDF リンクと日付を正しく抽出する", () => {
    const html = `
      <h3>令和7年　定例会</h3>
      <p>本会議</p>
      <dl>
        <dt>年月日</dt>
        <dd><a href="/uploaded/attachment/13890.pdf">7年第3回定例会 [PDFファイル／1.52MB]</a></dd>
        <dd>令和7年9月</dd>
        <dd><a href="/uploaded/attachment/13653.pdf">7年第2回定例会 [PDFファイル／1.53MB]</a></dd>
        <dd>令和7年6月</dd>
      </dl>
    `;

    const meetings = parsePlenaryPage(html, {
      url: "/site/gikai/1568.html",
      category: "plenary",
      label: "定例会",
    });

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.abashiri.hokkaido.jp/uploaded/attachment/13890.pdf",
    );
    expect(meetings[0]!.title).toBe("令和7年第3回定例会");
    expect(meetings[0]!.heldOn).toBe("2025-09-01");
    expect(meetings[0]!.category).toBe("plenary");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.abashiri.hokkaido.jp/uploaded/attachment/13653.pdf",
    );
    expect(meetings[1]!.title).toBe("令和7年第2回定例会");
    expect(meetings[1]!.heldOn).toBe("2025-06-01");
  });

  it("複数年度のセクションからリンクを抽出する", () => {
    const html = `
      <h3>令和7年　定例会</h3>
      <dl>
        <dt>年月日</dt>
        <dd><a href="/uploaded/attachment/13890.pdf">7年第3回定例会 [PDFファイル／1.52MB]</a></dd>
        <dd>令和7年9月</dd>
      </dl>
      <h3>令和6年　定例会</h3>
      <dl>
        <dt>年月日</dt>
        <dd><a href="/uploaded/attachment/12582.pdf">6年第4回定例会 [PDFファイル／1.55MB]</a></dd>
        <dd>令和6年12月</dd>
      </dl>
    `;

    const meetings = parsePlenaryPage(html, {
      url: "/site/gikai/1568.html",
      category: "plenary",
      label: "定例会",
    });

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-09-01");
    expect(meetings[1]!.heldOn).toBe("2024-12-01");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<h3>令和7年　定例会</h3><dl><dt>年月日</dt></dl>`;
    const meetings = parsePlenaryPage(html, {
      url: "/site/gikai/1568.html",
      category: "plenary",
      label: "定例会",
    });
    expect(meetings).toHaveLength(0);
  });
});

describe("parseCommitteePage", () => {
  it("委員会の PDF リンクと日付を正しく抽出する", () => {
    const html = `
      <h2>令和7年総務経済委員会</h2>
      <table>
        <tr><td>年月日</td><td>案件</td></tr>
        <tr>
          <td><a href="/uploaded/attachment/13850.pdf">令和7年10月31日 [PDFファイル／70KB]</a></td>
          <td><ul><li>委員長の辞任について</li></ul></td>
        </tr>
        <tr>
          <td><a href="/uploaded/attachment/13849.pdf">令和7年9月22日 [PDFファイル／120KB]</a></td>
          <td>付託議案審査1件</td>
        </tr>
      </table>
    `;

    const meetings = parseCommitteePage(html, {
      url: "/soshiki/32/6990.html",
      category: "committee",
      label: "総務経済委員会",
    });

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.abashiri.hokkaido.jp/uploaded/attachment/13850.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2025-10-31");
    expect(meetings[0]!.title).toBe("総務経済委員会 令和7年10月31日");
    expect(meetings[0]!.category).toBe("committee");

    expect(meetings[1]!.heldOn).toBe("2025-09-22");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<h2>令和7年総務経済委員会</h2><table></table>`;
    const meetings = parseCommitteePage(html, {
      url: "/soshiki/32/6990.html",
      category: "committee",
      label: "総務経済委員会",
    });
    expect(meetings).toHaveLength(0);
  });
});

describe("parseListPage", () => {
  it("category=committee のとき委員会パーサーを使う", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/uploaded/attachment/13850.pdf">令和7年10月31日 [PDFファイル／70KB]</a></td>
          <td>案件</td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, {
      url: "/soshiki/32/6990.html",
      category: "committee",
      label: "総務経済委員会",
    });

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("committee");
  });

  it("category=plenary のとき定例会パーサーを使う", () => {
    const html = `
      <h3>令和7年　定例会</h3>
      <dl>
        <dt>年月日</dt>
        <dd><a href="/uploaded/attachment/13890.pdf">7年第3回定例会 [PDFファイル／1.52MB]</a></dd>
        <dd>令和7年9月</dd>
      </dl>
    `;

    const meetings = parseListPage(html, {
      url: "/site/gikai/1568.html",
      category: "plenary",
      label: "定例会",
    });

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("plenary");
  });
});
