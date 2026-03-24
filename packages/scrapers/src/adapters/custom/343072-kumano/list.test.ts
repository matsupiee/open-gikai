import { describe, expect, it } from "vitest";
import { extractPdfLinks, parsePdfLinks, parseLinkText } from "./list";

describe("extractPdfLinks", () => {
  it("PDF リンクを抽出し、ファイルサイズ表記を除去する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1710119246226/files/reiwa6dai1kaiteireikaikaigiroku1gou.pdf">令和6年第1回熊野町議会定例会（3月5日）(PDF文書：548KB)</a></li>
        <li><a href="/www/contents/1710119246226/files/reiwa6dai1kaiteireikaimokuji.pdf">令和6年第1回熊野町議会定例会（目次）(PDF文書：64KB)</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kumano.hiroshima.jp/www/contents/1710119246226/files/reiwa6dai1kaiteireikaikaigiroku1gou.pdf"
    );
    expect(result[0]!.linkText).toBe("令和6年第1回熊野町議会定例会（3月5日）");
    expect(result[1]!.linkText).toBe("令和6年第1回熊野町議会定例会（目次）");
  });

  it("ファイルサイズ表記なしのリンクも正しく処理する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1710119246226/files/test.pdf">令和6年予算特別委員会</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("令和6年予算特別委員会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(extractPdfLinks(html)).toEqual([]);
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `<a href="https://example.com/file.pdf">テスト</a>`;
    const result = extractPdfLinks(html);
    expect(result[0]!.pdfUrl).toBe("https://example.com/file.pdf");
  });
});

describe("parseLinkText", () => {
  it("定例会（日付付き）を解析する", () => {
    const result = parseLinkText(
      "令和6年第1回熊野町議会定例会（3月5日）",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和6年第1回熊野町議会定例会（3月5日）");
    expect(result!.heldOn).toBe("2024-03-05");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.pdfUrl).toBe("https://example.com/file.pdf");
  });

  it("臨時会を解析する", () => {
    const result = parseLinkText(
      "令和6年第4回熊野町議会臨時会（12月10日）",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-12-10");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("全員協議会を解析する", () => {
    const result = parseLinkText(
      "令和6年第1回熊野町議会全員協議会（1月25日）",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-01-25");
    expect(result!.meetingType).toBe("committee");
  });

  it("予算特別委員会を解析する", () => {
    const result = parseLinkText(
      "令和6年予算特別委員会",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和6年予算特別委員会");
    expect(result!.meetingType).toBe("committee");
    expect(result!.heldOn).toBe("2024-01-01");
  });

  it("決算特別委員会を解析する", () => {
    const result = parseLinkText(
      "令和6年決算特別委員会",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("committee");
  });

  it("平成の年号を解析する", () => {
    const result = parseLinkText(
      "平成30年第1回熊野町議会定例会（3月1日）",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2018-03-01");
  });

  it("令和元年を解析する", () => {
    const result = parseLinkText(
      "令和元年第1回熊野町議会定例会（5月7日）",
      "https://example.com/file.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2019-05-07");
  });

  it("解析できないテキストは null を返す", () => {
    const result = parseLinkText(
      "その他のリンク",
      "https://example.com/file.pdf"
    );
    expect(result).toBeNull();
  });
});

describe("parsePdfLinks", () => {
  it("目次 PDF をスキップして本文 PDF のみ返す（実際のHTML形式）", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1710119246226/files/reiwa6dai1kaiteireikaimokuji.pdf">令和6年第1回熊野町議会定例会（目次）(PDF文書：64KB)</a></li>
        <li><a href="/www/contents/1710119246226/files/reiwa6dai1kaiteireikaikaigiroku1gou.pdf">令和6年第1回熊野町議会定例会（3月5日）(PDF文書：548KB)</a></li>
        <li><a href="/www/contents/1710119246226/files/reiwa6dai1kaiteireikaikaigirokudai2gou.pdf">令和6年第1回熊野町議会定例会（3月6日）(PDF文書：600KB)</a></li>
        <li><a href="/www/contents/1710119246226/files/reiwa6dai4rinnjimokuji.pdf">令和6年第4回熊野町議会臨時会（目次）(PDF文書：50KB)</a></li>
        <li><a href="/www/contents/1710119246226/files/reiwa6dai4rinnjikaigiroku.pdf">令和6年第4回熊野町議会臨時会（12月10日）(PDF文書：200KB)</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和6年第1回熊野町議会定例会（3月5日）");
    expect(result[0]!.heldOn).toBe("2024-03-05");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.heldOn).toBe("2024-03-06");
    expect(result[2]!.title).toBe("令和6年第4回熊野町議会臨時会（12月10日）");
    expect(result[2]!.meetingType).toBe("extraordinary");
  });

  it("予算/決算特別委員会の目次をスキップする（全角スペース区切り形式）", () => {
    const html = `
      <ul>
        <li><a href="/files/reiwa6yotokumokuji.pdf">令和6年予算特別委員会　目次(PDF文書：30KB)</a></li>
        <li><a href="/files/reiwa6yosan.pdf">令和6年予算特別委員会(PDF文書：400KB)</a></li>
        <li><a href="/files/r6kessanmokuji.pdf">令和6年決算特別委員会　目次(PDF文書：30KB)</a></li>
        <li><a href="/files/r6kessangiji.pdf">令和6年決算特別委員会(PDF文書：500KB)</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年予算特別委員会");
    expect(result[0]!.meetingType).toBe("committee");
    expect(result[1]!.title).toBe("令和6年決算特別委員会");
    expect(result[1]!.meetingType).toBe("committee");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });

  it("全員協議会と特別委員会を正しく処理する", () => {
    const html = `
      <ul>
        <li><a href="/files/zenkyo.pdf">令和6年第1回熊野町議会全員協議会（1月25日）(PDF文書：200KB)</a></li>
        <li><a href="/files/yotoku.pdf">令和6年予算特別委員会(PDF文書：400KB)</a></li>
        <li><a href="/files/kessan.pdf">令和6年決算特別委員会(PDF文書：500KB)</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.meetingType).toBe("committee");
    expect(result[1]!.meetingType).toBe("committee");
    expect(result[2]!.meetingType).toBe("committee");
  });
});
