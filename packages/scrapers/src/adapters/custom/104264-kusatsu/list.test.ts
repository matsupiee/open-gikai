import { describe, expect, it } from "vitest";
import { extractPdfLinks, parseLinkText, parsePdfLinks } from "./list";

describe("extractPdfLinks", () => {
  it("PDF リンクを抽出し、ファイルサイズ表記を除去する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1654156951891/files/R62.pdf">令和6年第2回草津町議会定例会会議録(PDF文書：500KB)</a></li>
        <li><a href="/www/contents/1654156951891/files/R61.pdf">令和6年第1回草津町議会臨時会会議録(PDF文書：200KB)</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/R62.pdf"
    );
    expect(result[0]!.linkText).toBe("令和6年第2回草津町議会定例会会議録");
    expect(result[1]!.linkText).toBe("令和6年第1回草津町議会臨時会会議録");
  });

  it("ファイルサイズ表記なしのリンクも正しく処理する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1654156951891/files/dai3kai-teireikai.pdf">令和4年第3回草津町議会定例会会議録</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("令和4年第3回草津町議会定例会会議録");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(extractPdfLinks(html)).toEqual([]);
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `<a href="https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/test.pdf">テスト</a>`;
    const result = extractPdfLinks(html);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/test.pdf"
    );
  });
});

describe("parseLinkText", () => {
  it("定例会を解析する", () => {
    const result = parseLinkText(
      "令和6年第2回草津町議会定例会会議録",
      "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/R62.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和6年第2回草津町議会定例会会議録");
    expect(result!.year).toBe(2024);
    expect(result!.meetingType).toBe("plenary");
    expect(result!.pdfUrl).toBe(
      "https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/files/R62.pdf"
    );
  });

  it("臨時会を解析する", () => {
    const result = parseLinkText(
      "令和6年第1回草津町議会臨時会会議録",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("令和4年を正しく解析する", () => {
    const result = parseLinkText(
      "令和4年第3回草津町議会定例会会議録",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2022);
    expect(result!.meetingType).toBe("plenary");
  });

  it("令和5年を正しく解析する", () => {
    const result = parseLinkText(
      "令和5年第7回草津町議会定例会会議録",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
  });

  it("令和元年を解析する", () => {
    const result = parseLinkText(
      "令和元年第1回草津町議会定例会会議録",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
  });

  it("解析できないテキストは null を返す", () => {
    const result = parseLinkText(
      "その他のリンク",
      "https://example.com/file.pdf"
    );
    expect(result).toBeNull();
  });

  it("草津町以外の自治体名は null を返す", () => {
    const result = parseLinkText(
      "令和6年第1回他町議会定例会会議録",
      "https://example.com/file.pdf"
    );
    expect(result).toBeNull();
  });
});

describe("parsePdfLinks", () => {
  it("草津町議会会議録の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1654156951891/files/R61.pdf">令和6年第1回草津町議会臨時会会議録</a></li>
        <li><a href="/www/contents/1654156951891/files/R62.pdf">令和6年第2回草津町議会定例会会議録</a></li>
        <li><a href="/www/contents/1654156951891/files/R63.pdf">令和6年第4回草津町議会定例会会議録</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和6年第1回草津町議会臨時会会議録");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.title).toBe("令和6年第2回草津町議会定例会会議録");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[2]!.meetingType).toBe("plenary");
  });

  it("複数年度が混在する場合も全て返す", () => {
    const html = `
      <ul>
        <li><a href="/files/r51.pdf">令和5年第1回草津町議会定例会会議録</a></li>
        <li><a href="/files/R62.pdf">令和6年第2回草津町議会定例会会議録</a></li>
        <li><a href="/files/dai3kai-teireikai.pdf">令和4年第3回草津町議会定例会会議録</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.year).toBe(2023);
    expect(result[1]!.year).toBe(2024);
    expect(result[2]!.year).toBe(2022);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });

  it("草津町議会のパターン以外はスキップする", () => {
    const html = `
      <ul>
        <li><a href="/files/other.pdf">その他のPDF文書</a></li>
        <li><a href="/files/R62.pdf">令和6年第2回草津町議会定例会会議録</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第2回草津町議会定例会会議録");
  });
});
