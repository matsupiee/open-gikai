import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年(2024年)")).toBe(2024);
    expect(parseWarekiYear("令和7年(2025年)")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年(2019年)")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年(2018年)")).toBe(2018);
    expect(parseWarekiYear("平成24年(2012年)")).toBe(2012);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第４回定例会(12月）")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第１回臨時会(4月)")).toBe("extraordinary");
  });
});

describe("parseListPage", () => {
  it("h2の年度配下のPDFリンクを抽出する", () => {
    const html = `
      <div>
        <h2>令和６年(2024年)</h2>
        <table>
          <tr>
            <td><a href="files/Gikai-TeireiRec202412re.pdf">第４回定例会(12月）</a></td>
            <td><a href="files/Gikai-TeireiRec202409.pdf">第３回定例会(9月）</a></td>
          </tr>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和６年第４回定例会(12月）",
      year: 2024,
      pdfUrl: "https://www.town.nanbu.yamanashi.jp/kakuka/gikai/files/Gikai-TeireiRec202412re.pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "令和６年第３回定例会(9月）",
      year: 2024,
      pdfUrl: "https://www.town.nanbu.yamanashi.jp/kakuka/gikai/files/Gikai-TeireiRec202409.pdf",
      meetingType: "plenary",
    });
  });

  it("臨時会を正しく検出する", () => {
    const html = `
      <div>
        <h2>令和７年(2025年)</h2>
        <table>
          <tr>
            <td><a href="files/Gikai-RinjiRec202507.pdf">第３回臨時会(7月)</a></td>
          </tr>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.title).toBe("令和７年第３回臨時会(7月)");
  });

  it("複数の年度が混在しても全て抽出する", () => {
    const html = `
      <div>
        <h2>令和７年(2025年)</h2>
        <table>
          <tr>
            <td><a href="files/Gikai-TeireiRec202503.pdf">第１回定例会(3月）</a></td>
          </tr>
        </table>
        <h2>令和６年(2024年)</h2>
        <table>
          <tr>
            <td><a href="files/Gikai-TeireiRec202412re.pdf">第４回定例会(12月）</a></td>
            <td><a href="files/Gikai-TeireiRec202409.pdf">第３回定例会(9月）</a></td>
          </tr>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.year === 2025)).toHaveLength(1);
    expect(result.filter((r) => r.year === 2024)).toHaveLength(2);
  });

  it("平成の会議録も正しく抽出する", () => {
    const html = `
      <div>
        <h2>平成２４年(2012年)</h2>
        <table>
          <tr>
            <td><a href="files/201203-teireikai.pdf">第１回定例会(3月)</a></td>
          </tr>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2012);
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("files/以外のPDFリンクは除外する", () => {
    const html = `
      <div>
        <h2>令和６年(2024年)</h2>
        <table>
          <tr>
            <td><a href="/other/doc.pdf">他の文書</a></td>
            <td><a href="files/Gikai-TeireiRec202412re.pdf">第４回定例会(12月）</a></td>
          </tr>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("files/Gikai-TeireiRec202412re.pdf");
  });

  it("PDFリンクのないh2は無視する", () => {
    const html = `
      <div>
        <h2>令和８年(2026年)</h2>
        <table>
          <tr><td>掲載予定</td></tr>
        </table>
        <h2>令和７年(2025年)</h2>
        <table>
          <tr>
            <td><a href="files/Gikai-TeireiRec202512re.pdf">第４回定例会(12月）</a></td>
          </tr>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("タイポのあるファイル名（ドット2つ）もhrefそのまま使用する", () => {
    const html = `
      <div>
        <h2>令和６年(2024年)</h2>
        <table>
          <tr>
            <td><a href="files/Gikai-TeireiRec202403..pdf">第１回定例会(3月）</a></td>
          </tr>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("Gikai-TeireiRec202403..pdf");
  });

  it("空のHTMLで空配列を返す", () => {
    expect(parseListPage("<p>No links here</p>")).toEqual([]);
  });
});
