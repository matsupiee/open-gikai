import { describe, expect, it } from "vitest";
import { extractPdfRecords } from "./list";

describe("extractPdfRecords", () => {
  it("定例会の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/assets/files/gikai/R6.9kaigiroku.pdf">令和６年第４回定例会</a></li>
          <li><a href="/assets/files/gikai/R6.6kaigiroku.pdf">令和６年第３回定例会</a></li>
          <li><a href="/assets/files/gikai/R6.3kaigiroku.pdf">令和６年第２回定例会</a></li>
        </ul>
      </body>
      </html>
    `;

    const records = extractPdfRecords(html, 2024, "https://www.town.ichinomiya.chiba.jp/info/gikai/2/15.html");

    expect(records).toHaveLength(3);
    expect(records[0]!.title).toBe("令和６年第４回定例会");
    expect(records[0]!.pdfUrl).toBe("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/R6.9kaigiroku.pdf");
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[0]!.year).toBe(2024);
    expect(records[1]!.pdfUrl).toBe("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/R6.6kaigiroku.pdf");
    expect(records[2]!.pdfUrl).toBe("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/R6.3kaigiroku.pdf");
  });

  it("臨時会の会議種別が extraordinary になる", () => {
    const html = `
      <ul>
        <li><a href="/assets/files/gikai/R6.9kaigiroku.pdf">令和６年第２回臨時会</a></li>
      </ul>
    `;

    const records = extractPdfRecords(html, 2024, "https://www.town.ichinomiya.chiba.jp/info/gikai/2/15.html");

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("YYYYMMDD 形式の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/assets/files/gikai/20240529.pdf">令和６年第２回定例会</a></li>
      </ul>
    `;

    const records = extractPdfRecords(html, 2024, "https://www.town.ichinomiya.chiba.jp/info/gikai/2/15.html");

    expect(records).toHaveLength(1);
    expect(records[0]!.pdfUrl).toBe("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/20240529.pdf");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <ul>
        <li><a href="/assets/files/gikai/R6.9kaigiroku.pdf">令和６年第４回定例会</a></li>
        <li><a href="/assets/files/gikai/R6.9kaigiroku.pdf">令和６年第４回定例会</a></li>
      </ul>
    `;

    const records = extractPdfRecords(html, 2024, "https://www.town.ichinomiya.chiba.jp/info/gikai/2/15.html");

    expect(records).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/info/gikai/2/15.html">令和６年</a></li>
      </ul>
    `;

    const records = extractPdfRecords(html, 2024, "https://www.town.ichinomiya.chiba.jp/info/gikai/2/15.html");

    expect(records).toHaveLength(0);
  });

  it("古い年度の yakubaannai2 ディレクトリの PDF も抽出する", () => {
    const html = `
      <ul>
        <li><a href="/assets/files/yakubaannai2/gikai251205.pdf">平成２５年第４回定例会</a></li>
      </ul>
    `;

    const records = extractPdfRecords(html, 2013, "https://www.town.ichinomiya.chiba.jp/info/gikai/2/5.html");

    expect(records).toHaveLength(1);
    expect(records[0]!.pdfUrl).toBe("https://www.town.ichinomiya.chiba.jp/assets/files/yakubaannai2/gikai251205.pdf");
    expect(records[0]!.year).toBe(2013);
  });
});
