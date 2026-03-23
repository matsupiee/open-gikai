import { describe, expect, it } from "vitest";
import { extractYearFromHeading, parseLinkDate, parseListPage } from "./list";

describe("parseLinkDate", () => {
  it("全角数字の日付をパースする", () => {
    const result = parseLinkDate("第１日12月２日");
    expect(result).toEqual({ month: 12, day: 2 });
  });

  it("半角数字の日付をパースする", () => {
    const result = parseLinkDate("第1号12月6日");
    expect(result).toEqual({ month: 12, day: 6 });
  });

  it("第2日パターンをパースする", () => {
    const result = parseLinkDate("第２日12月４日");
    expect(result).toEqual({ month: 12, day: 4 });
  });

  it("目次は null を返す", () => {
    expect(parseLinkDate("目次")).toBeNull();
  });

  it("日付のないテキストは null を返す", () => {
    expect(parseLinkDate("資料一覧")).toBeNull();
  });
});

describe("extractYearFromHeading", () => {
  it("令和の全角数字をパースする", () => {
    expect(extractYearFromHeading("令和７年第４回定例会")).toBe(2025);
  });

  it("平成の半角数字をパースする", () => {
    expect(extractYearFromHeading("平成24年第4回定例会")).toBe(2012);
  });

  it("令和元年をパースする", () => {
    expect(extractYearFromHeading("令和元年第1回定例会")).toBe(2019);
  });

  it("平成元年をパースする", () => {
    expect(extractYearFromHeading("平成元年第1回定例会")).toBe(1989);
  });

  it("和暦を含まないテキストは null を返す", () => {
    expect(extractYearFromHeading("会議録一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("令和7年の定例会 PDF リンクを抽出する", () => {
    const html = `
      <h2>令和７年会議録一覧</h2>
      <h3>定例会</h3>
      <h4>令和７年第４回定例会</h4>
      <p><a href="files/0704_teirei_kaigiroku_mokuji.pdf">目次<img alt="PDFファイル" src="../../../_wcv/images/icon/pdf.gif">(542KB)</a></p>
      <p><a href="files/0704_teirei_kaigiroku_1202.pdf">第１日12月２日<img alt="PDFファイル" src="../../../_wcv/images/icon/pdf.gif">(585KB)</a></p>
      <p><a href="files/0704_teirei_kaigiroku_1204.pdf">第２日12月４日<img alt="PDFファイル" src="../../../_wcv/images/icon/pdf.gif">(2358KB)</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("令和７年第４回定例会");
    expect(meetings[0]!.heldOn).toBe("2025-12-02");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.hirakawa.lg.jp/jouhou/gikai/nittei/files/0704_teirei_kaigiroku_1202.pdf"
    );

    expect(meetings[1]!.heldOn).toBe("2025-12-04");
  });

  it("臨時会 PDF リンクを抽出する", () => {
    const html = `
      <h2>令和７年会議録一覧</h2>
      <h3>臨時会</h3>
      <h4>令和７年第２回臨時会</h4>
      <p><a href="files/1125_rinnji_kaigiroku_1125.pdf">第１日11月25日<img alt="PDFファイル" src="../../../_wcv/images/icon/pdf.gif">(426KB)</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和７年第２回臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-11-25");
  });

  it("旧形式（平成24年）の ul/li 構造を抽出する", () => {
    const html = `
      <h2>平成24年会議録一覧</h2>
      <h3>定例会</h3>
      <h4>平成24年第4回定例会</h4>
      <ul>
        <li><a href="files/24_4teirei_mokuji.pdf">目次<img alt="PDFファイル" src="../../../_wcv/images/icon/pdf.gif">(108KB)</a></li>
        <li><a href="files/24_4teirei_1.pdf">第1号12月6日<img alt="PDFファイル" src="../../../_wcv/images/icon/pdf.gif">(251KB)</a></li>
        <li><a href="files/24_4teirei_2.pdf">第2号12月11日<img alt="PDFファイル" src="../../../_wcv/images/icon/pdf.gif">(398KB)</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2012);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2012-12-06");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.hirakawa.lg.jp/jouhou/gikai/nittei/files/24_4teirei_1.pdf"
    );
    expect(meetings[1]!.heldOn).toBe("2012-12-11");
  });

  it("目次ファイルをスキップする", () => {
    const html = `
      <h4>令和６年第１回定例会</h4>
      <p><a href="files/0601_teirei_kaigiroku_mokuji.pdf">目次<img alt="PDFファイル">(100KB)</a></p>
      <p><a href="files/0601_teirei_kaigiroku_0301.pdf">第１日3月１日<img alt="PDFファイル">(500KB)</a></p>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
  });

  it("年フィルタリングが機能する", () => {
    const html = `
      <h4>令和７年第４回定例会</h4>
      <p><a href="files/0704_teirei_kaigiroku_1202.pdf">第１日12月２日<img alt="PDFファイル">(585KB)</a></p>
      <h4>令和６年第４回定例会</h4>
      <p><a href="files/0604_teirei_kaigiroku_1203.pdf">第１日12月３日<img alt="PDFファイル">(671KB)</a></p>
    `;

    const meetings2025 = parseListPage(html, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-12-02");

    const meetings2024 = parseListPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-03");
  });

  it("年フィルタなしで全件を返す", () => {
    const html = `
      <h4>令和７年第４回定例会</h4>
      <p><a href="files/0704_teirei_kaigiroku_1202.pdf">第１日12月２日<img alt="PDFファイル">(585KB)</a></p>
      <h4>令和６年第４回定例会</h4>
      <p><a href="files/0604_teirei_kaigiroku_1203.pdf">第１日12月３日<img alt="PDFファイル">(671KB)</a></p>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(2);
  });
});
