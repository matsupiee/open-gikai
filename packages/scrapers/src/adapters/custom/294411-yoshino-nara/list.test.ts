import { describe, expect, it } from "vitest";
import { parseYearPage, parseMeetingDate } from "./list";

describe("parseMeetingDate", () => {
  it("月と日がある場合、正しく heldOn を返す", () => {
    const result = parseMeetingDate("令和7年第1回臨時会(4月28日) (PDFファイル: 472.4KB)", 2025);
    expect(result.heldOn).toBe("2025-04-28");
    expect(result.month).toBe(4);
  });

  it("月のみの場合、heldOn は null、month は返す", () => {
    const result = parseMeetingDate("令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)", 2025);
    expect(result.heldOn).toBeNull();
    expect(result.month).toBe(3);
  });

  it("日付情報がない場合、heldOn・month ともに null", () => {
    const result = parseMeetingDate("令和7年第1回定例会 (PDFファイル: 1.9MB)", 2025);
    expect(result.heldOn).toBeNull();
    expect(result.month).toBeNull();
  });

  it("一桁の月・日をゼロパディングする", () => {
    const result = parseMeetingDate("令和7年第2回臨時会(7月5日)", 2025);
    expect(result.heldOn).toBe("2025-07-05");
  });

  it("12月の日付を正しくパースする", () => {
    const result = parseMeetingDate("令和6年第4回(12月)定例会 (PDFファイル: 1.2MB)", 2024);
    expect(result.heldOn).toBeNull();
    expect(result.month).toBe(12);
  });
});

describe("parseYearPage", () => {
  it("PDF リンクとメタ情報を正しく抽出する（定例会）", () => {
    const html = `
      <div>
        <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R7_teirei1_03.pdf">令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)</a></p>
        <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R7_teirei2_06.pdf">令和7年第2回(6月)定例会 (PDFファイル: 2.1MB)</a></p>
      </div>
    `;

    const records = parseYearPage(html, 2025);

    expect(records).toHaveLength(2);
    expect(records[0]!.title).toBe("令和7年第1回(3月)定例会");
    expect(records[0]!.pdfUrl).toBe("https://www.town.yoshino.nara.jp/material/files/group/20/R7_teirei1_03.pdf");
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[0]!.heldOn).toBeNull();

    expect(records[1]!.title).toBe("令和7年第2回(6月)定例会");
    expect(records[1]!.pdfUrl).toBe("https://www.town.yoshino.nara.jp/material/files/group/20/R7_teirei2_06.pdf");
  });

  it("臨時会の meetingType を extraordinary に分類する", () => {
    const html = `
      <div>
        <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R7_rin1_04.pdf">令和7年第1回臨時会(4月28日) (PDFファイル: 472.4KB)</a></p>
      </div>
    `;

    const records = parseYearPage(html, 2025);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
    expect(records[0]!.heldOn).toBe("2025-04-28");
  });

  it("プロトコル相対 URL を https: に補完する", () => {
    const html = `
      <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R6_teirei1_03.pdf">令和6年第1回(3月)定例会 (PDFファイル: 1.8MB)</a></p>
    `;

    const records = parseYearPage(html, 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.pdfUrl).toBe("https://www.town.yoshino.nara.jp/material/files/group/20/R6_teirei1_03.pdf");
  });

  it("絶対パス形式の URL を補完する", () => {
    const html = `
      <p><a href="/material/files/group/20/R6_rin1_02.pdf">令和6年第1回臨時会(2月14日) (PDFファイル: 300KB)</a></p>
    `;

    const records = parseYearPage(html, 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.pdfUrl).toBe("https://www.town.yoshino.nara.jp/material/files/group/20/R6_rin1_02.pdf");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R7_teirei1_03.pdf">令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)</a></p>
      <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R7_teirei1_03.pdf">令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)</a></p>
    `;

    const records = parseYearPage(html, 2025);

    expect(records).toHaveLength(1);
  });

  it("PDF がない場合は空配列を返す", () => {
    const html = `
      <div>
        <p>準備中</p>
      </div>
    `;

    const records = parseYearPage(html, 2025);

    expect(records).toHaveLength(0);
  });

  it("平成31年（令和元年）の H31 ファイルを正しく処理する", () => {
    const html = `
      <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/H31_teirei1_03.pdf">平成31年第1回(3月)定例会 (PDFファイル: 1.5MB)</a></p>
      <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R1_teirei3_09.pdf">令和元年第3回(9月)定例会 (PDFファイル: 1.7MB)</a></p>
    `;

    const records = parseYearPage(html, 2019);

    expect(records).toHaveLength(2);
    expect(records[0]!.pdfUrl).toBe("https://www.town.yoshino.nara.jp/material/files/group/20/H31_teirei1_03.pdf");
    expect(records[1]!.pdfUrl).toBe("https://www.town.yoshino.nara.jp/material/files/group/20/R1_teirei3_09.pdf");
  });

  it("group/20 以外の URL は無視する", () => {
    const html = `
      <p><a href="//www.town.yoshino.nara.jp/material/files/group/5/other.pdf">他のファイル</a></p>
      <p><a href="//www.town.yoshino.nara.jp/material/files/group/20/R7_teirei1_03.pdf">令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)</a></p>
    `;

    const records = parseYearPage(html, 2025);

    expect(records).toHaveLength(1);
    expect(records[0]!.pdfUrl).toContain("/group/20/");
  });
});
