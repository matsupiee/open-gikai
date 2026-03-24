import { describe, expect, it } from "vitest";
import { extractPdfLinks, parseMonthDay, parseLinkInfo, parsePdfLinks } from "./list";

describe("extractPdfLinks", () => {
  it("PDF リンクを抽出し年度コンテキストを付与する", () => {
    const html = `
      <h2>令和6年（2024年）</h2>
      <ul>
        <li><a href="/uploaded/attachment/12345.pdf">第4回定例会12月定例会議(12月3日～16日)</a></li>
        <li><a href="/uploaded/attachment/12346.pdf">第3回定例会9月定例会議(9月10日～18日)</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.nakanojo.gunma.jp/uploaded/attachment/12345.pdf"
    );
    expect(result[0]!.linkText).toBe("第4回定例会12月定例会議(12月3日～16日)");
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.year).toBe(2024);
  });

  it("複数年度が混在する場合に年度コンテキストを正しく切り替える", () => {
    const html = `
      <h2>令和7年（2025年）</h2>
      <ul>
        <li><a href="/uploaded/attachment/99999.pdf">第1回定例会招集会議(1月16日)</a></li>
      </ul>
      <h2>令和6年（2024年）</h2>
      <ul>
        <li><a href="/uploaded/attachment/88888.pdf">第4回定例会12月定例会議(12月3日～16日)</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.year).toBe(2024);
  });

  it("uploaded/attachment 以外の PDF リンクも収集する", () => {
    const html = `
      <h2>令和6年</h2>
      <a href="/other/path/doc.pdf">その他のPDF</a>
    `;

    const result = extractPdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("その他のPDF");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(extractPdfLinks(html)).toEqual([]);
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <h2>令和6年</h2>
      <a href="https://www.town.nakanojo.gunma.jp/uploaded/attachment/99.pdf">テスト</a>
    `;

    const result = extractPdfLinks(html);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.nakanojo.gunma.jp/uploaded/attachment/99.pdf"
    );
  });
});

describe("parseMonthDay", () => {
  it("単日の開催日を解析する", () => {
    const result = parseMonthDay("第1回定例会招集会議(1月16日)");
    expect(result.month).toBe(1);
    expect(result.day).toBe(16);
  });

  it("開始日〜終了日パターンで開始日を返す", () => {
    const result = parseMonthDay("第4回定例会12月定例会議(12月3日～16日)");
    expect(result.month).toBe(12);
    expect(result.day).toBe(3);
  });

  it("全角数字を正しく解析する", () => {
    const result = parseMonthDay("第１回定例会招集会議（１月１６日）");
    expect(result.month).toBe(1);
    expect(result.day).toBe(16);
  });

  it("日付が含まれない場合は null を返す", () => {
    const result = parseMonthDay("その他の文書");
    expect(result.month).toBeNull();
    expect(result.day).toBeNull();
  });

  it("臨時会議の日付を解析する", () => {
    const result = parseMonthDay("第1回定例会第3回臨時会議(10月21日)");
    expect(result.month).toBe(10);
    expect(result.day).toBe(21);
  });
});

describe("parseLinkInfo", () => {
  it("定例会のリンク情報を解析する", () => {
    const result = parseLinkInfo(
      "第4回定例会12月定例会議(12月3日～16日)",
      "https://www.town.nakanojo.gunma.jp/uploaded/attachment/12345.pdf",
      2024
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(12);
    expect(result!.day).toBe(3);
    expect(result!.meetingType).toBe("plenary");
    expect(result!.pdfUrl).toContain("/uploaded/attachment/12345.pdf");
  });

  it("臨時会議は extraordinary として分類する", () => {
    const result = parseLinkInfo(
      "第1回定例会第3回臨時会議(10月21日)",
      "https://www.town.nakanojo.gunma.jp/uploaded/attachment/99999.pdf",
      2024
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("年度が null の場合は null を返す", () => {
    const result = parseLinkInfo(
      "第1回定例会招集会議(1月16日)",
      "https://www.town.nakanojo.gunma.jp/uploaded/attachment/12345.pdf",
      null
    );
    expect(result).toBeNull();
  });

  it("/uploaded/attachment/ を含まない URL は null を返す", () => {
    const result = parseLinkInfo(
      "その他のPDF",
      "https://www.town.nakanojo.gunma.jp/other/doc.pdf",
      2024
    );
    expect(result).toBeNull();
  });

  it("招集会議は plenary として分類する", () => {
    const result = parseLinkInfo(
      "第1回定例会招集会議(1月16日)",
      "https://www.town.nakanojo.gunma.jp/uploaded/attachment/11111.pdf",
      2024
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("plenary");
  });
});

describe("parsePdfLinks", () => {
  it("一覧ページから会議録リンクを抽出する", () => {
    const html = `
      <h2>令和6年（2024年）</h2>
      <ul>
        <li><a href="/uploaded/attachment/12345.pdf">第4回定例会12月定例会議(12月3日～16日)</a></li>
        <li><a href="/uploaded/attachment/12346.pdf">第1回定例会第3回臨時会議(10月21日)</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.meetingType).toBe("extraordinary");
  });

  it("/uploaded/attachment/ 以外の PDF はスキップする", () => {
    const html = `
      <h2>令和6年</h2>
      <a href="/other/file.pdf">その他</a>
      <a href="/uploaded/attachment/12345.pdf">第4回定例会12月定例会議(12月3日)</a>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });

  it("複数年度の場合に正しく年度を設定する", () => {
    const html = `
      <h2>令和7年（2025年）</h2>
      <a href="/uploaded/attachment/20001.pdf">第1回定例会招集会議(1月16日)</a>
      <h2>令和6年（2024年）</h2>
      <a href="/uploaded/attachment/18001.pdf">第4回定例会12月定例会議(12月3日)</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.year).toBe(2024);
  });
});
