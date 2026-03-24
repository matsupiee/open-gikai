import { describe, expect, it } from "vitest";
import { isTocPdf, parseYearPage } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第3回定例会")).toBe(2024);
    expect(parseWarekiYear("令和元年第2回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第3回定例会")).toBe(2018);
    expect(parseWarekiYear("平成25年第1回定例会")).toBe(2013);
    expect(parseWarekiYear("平成元年第1回定例会")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年第3回定例会会議録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和7年第1回臨時会会議録")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("令和6年総務委員会会議録")).toBe("committee");
  });
});

describe("isTocPdf", () => {
  it("mokuji を含む URL は目次として判定する", () => {
    expect(isTocPdf("https://example.com/R0712tei-mokuji.pdf", "目次")).toBe(true);
    expect(isTocPdf("https://example.com/2712teirei-mokuji.pdf", "目次")).toBe(true);
  });

  it("re3c.pdf パターンは目次として判定する", () => {
    expect(isTocPdf("https://example.com/h15/re3c.pdf", "")).toBe(true);
    expect(isTocPdf("https://example.com/h16/re12c.pdf", "")).toBe(true);
  });

  it("リンクテキストに目次が含まれる場合は目次として判定する", () => {
    expect(isTocPdf("https://example.com/some.pdf", "目次")).toBe(true);
  });

  it("通常の PDF は目次でないと判定する", () => {
    expect(isTocPdf("https://example.com/R0712tei1.pdf", "定例会会議録")).toBe(false);
    expect(isTocPdf("https://example.com/h15/re3t.pdf", "定例会会議録")).toBe(false);
  });
});

describe("parseYearPage", () => {
  it("年度別ページからPDFリンクを抽出する", () => {
    const html = `
      <div class="content">
        <h3>定例会</h3>
        <ul>
          <li>
            <a href="/content/files/gikaijimukyoku/R0612tei1.pdf">令和6年第3回定例会会議録（1日目）</a>
          </li>
          <li>
            <a href="/content/files/gikaijimukyoku/R0612tei2.pdf">令和6年第3回定例会会議録（2日目）</a>
          </li>
        </ul>
        <h3>臨時会</h3>
        <ul>
          <li>
            <a href="/content/files/gikaijimukyoku/070220R.pdf">令和7年2月臨時会会議録</a>
          </li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/10.html");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和6年第3回定例会会議録（1日目）",
      pdfUrl: "https://www.town.onjuku.chiba.jp/content/files/gikaijimukyoku/R0612tei1.pdf",
      meetingType: "plenary",
      yearPageUrl: "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/10.html",
    });
    expect(result[2]!.meetingType).toBe("extraordinary");
  });

  it("目次 PDF を除外する", () => {
    const html = `
      <ul>
        <li><a href="/content/files/gikaijimukyoku/R0612tei-mokuji.pdf">令和6年第3回定例会目次</a></li>
        <li><a href="/content/files/gikaijimukyoku/R0612tei1.pdf">令和6年第3回定例会会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/10.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("R0612tei1.pdf");
  });

  it("PDFサイズ情報をタイトルから除去する", () => {
    const html = `
      <a href="/content/files/gikaijimukyoku/R0612tei1.pdf">令和6年第3回定例会会議録（PDF：1.5MB）</a>
    `;

    const result = parseYearPage(html, "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/10.html");
    expect(result[0]!.title).toBe("令和6年第3回定例会会議録");
  });

  it("重複PDFリンクを除外する", () => {
    const html = `
      <a href="/content/files/gikaijimukyoku/R0612tei1.pdf">令和6年第3回定例会会議録</a>
      <a href="/content/files/gikaijimukyoku/R0612tei1.pdf">令和6年第3回定例会会議録（再掲）</a>
    `;

    const result = parseYearPage(html, "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/10.html");
    expect(result).toHaveLength(1);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません。</p>";
    expect(parseYearPage(html, "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/10.html")).toEqual([]);
  });

  it("絶対URLのPDFリンクをそのまま使う", () => {
    const html = `
      <a href="https://www.town.onjuku.chiba.jp/content/files/gikaijimukyoku/R0612tei1.pdf">
        令和6年第3回定例会会議録
      </a>
    `;

    const result = parseYearPage(html, "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/10.html");
    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.onjuku.chiba.jp/content/files/gikaijimukyoku/R0612tei1.pdf",
    );
  });

  it("旧フォーマット(平成)のPDFリンクを処理する", () => {
    const html = `
      <h3>定例会</h3>
      <ul>
        <li><a href="/content/files/old/gikaijimukyoku/gikai/gijiroku/h15/re3t.pdf">平成15年第2回定例会会議録</a></li>
        <li><a href="/content/files/old/gikaijimukyoku/gikai/gijiroku/h15/re3c.pdf">平成15年第2回定例会目次</a></li>
      </ul>
    `;

    const result = parseYearPage(html, "https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/h15.html");
    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("re3t.pdf");
  });
});
