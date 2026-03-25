import { describe, expect, it } from "vitest";
import { parsePdfLinks, inferYearFromLinkText } from "./list";

describe("parsePdfLinks", () => {
  it("h2/h3 見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和7年</h2>
        <h3>定例会</h3>
        <ul>
          <li><a href="/uploaded/attachment/27759.pdf">令和7年第4回定例会</a></li>
          <li><a href="/uploaded/attachment/27235.pdf">令和7年第3回定例会</a></li>
        </ul>
        <h3>予算特別委員会会議録</h3>
        <ul>
          <li><a href="/uploaded/attachment/27100.pdf">令和7年度予算特別委員会</a></li>
        </ul>
        <h2>令和6年</h2>
        <h3>定例会</h3>
        <ul>
          <li><a href="/uploaded/attachment/26000.pdf">令和6年第4回定例会</a></li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(4);

    expect(meetings[0]!.pdfUrl).toBe("https://www.city.shiogama.miyagi.jp/uploaded/attachment/27759.pdf");
    expect(meetings[0]!.title).toBe("令和7年第4回定例会");
    expect(meetings[0]!.yearHeading).toBe("令和7年");
    expect(meetings[0]!.typeHeading).toBe("定例会");
    expect(meetings[0]!.year).toBe(2025);

    expect(meetings[1]!.pdfUrl).toBe("https://www.city.shiogama.miyagi.jp/uploaded/attachment/27235.pdf");
    expect(meetings[1]!.title).toBe("令和7年第3回定例会");

    expect(meetings[2]!.typeHeading).toBe("予算特別委員会会議録");
    expect(meetings[2]!.title).toBe("令和7年度予算特別委員会");

    expect(meetings[3]!.year).toBe(2024);
    expect(meetings[3]!.yearHeading).toBe("令和6年");
  });

  it("委員会リンク（日付付き）の heldOn を正しく抽出する", () => {
    const html = `
      <h2>令和7年</h2>
      <h3>総務教育常任委員会</h3>
      <ul>
        <li><a href="/uploaded/attachment/27760.pdf">令和7年12月12日総務教育常任委員会</a></li>
        <li><a href="/uploaded/attachment/27500.pdf">令和7年9月5日総務教育常任委員会</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-12-12");
    expect(meetings[1]!.heldOn).toBe("2025-09-05");
  });

  it("定例会リンク（日付なし）の heldOn は null になる", () => {
    const html = `
      <h2>令和7年</h2>
      <h3>定例会</h3>
      <ul>
        <li><a href="/uploaded/attachment/27759.pdf">令和7年第4回定例会</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><h2>令和7年</h2><p>内容なし</p></body></html>`;
    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(0);
  });

  it("年号見出し（h2）がない場合は PDF リンクをスキップする", () => {
    const html = `
      <h3>定例会</h3>
      <ul>
        <li><a href="/uploaded/attachment/12345.pdf">令和7年第1回定例会</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(0);
  });

  it("令和元年を正しく変換する", () => {
    const html = `
      <h2>令和元年</h2>
      <h3>定例会</h3>
      <ul>
        <li><a href="/uploaded/attachment/10000.pdf">令和元年第4回定例会</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2019);
  });

  it("平成年号を正しく変換する", () => {
    const html = `
      <h2>平成16年</h2>
      <h3>定例会</h3>
      <ul>
        <li><a href="/uploaded/attachment/1000.pdf">平成16年第4回定例会</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2004);
  });

  it("臨時会を正しく認識する", () => {
    const html = `
      <h2>令和7年</h2>
      <h3>臨時会</h3>
      <ul>
        <li><a href="/uploaded/attachment/28000.pdf">令和7年臨時会</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.typeHeading).toBe("臨時会");
  });

  it("完全 URL の PDF リンクをそのまま使用する", () => {
    const html = `
      <h2>令和7年</h2>
      <h3>定例会</h3>
      <ul>
        <li><a href="https://www.city.shiogama.miyagi.jp/uploaded/attachment/99999.pdf">令和7年第1回定例会</a></li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe("https://www.city.shiogama.miyagi.jp/uploaded/attachment/99999.pdf");
  });
});

describe("inferYearFromLinkText", () => {
  it("令和7年を正しく変換する", () => {
    expect(inferYearFromLinkText("令和7年第4回定例会")).toBe(2025);
  });

  it("令和元年を正しく変換する", () => {
    expect(inferYearFromLinkText("令和元年第1回定例会")).toBe(2019);
  });

  it("平成16年を正しく変換する", () => {
    expect(inferYearFromLinkText("平成16年第4回定例会")).toBe(2004);
  });

  it("年が取得できない場合は null を返す", () => {
    expect(inferYearFromLinkText("会議録一覧")).toBeNull();
  });
});
