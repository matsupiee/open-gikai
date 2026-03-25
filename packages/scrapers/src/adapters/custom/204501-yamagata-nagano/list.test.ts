import { describe, expect, it } from "vitest";
import { parseWarekiYear, detectMeetingType } from "./shared";
import { parseYearPageLinks, parseYearPagePdfs } from "./list";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和元年")).toBe(2019);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年")).toBe(2019);
    expect(parseWarekiYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("定例会")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
    expect(detectMeetingType("令和6年山形村議会第1回定例会（第1号）")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
    expect(detectMeetingType("令和6年山形村議会第1回臨時会")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearPageLinks", () => {
  it("/docs/{ID}.html 形式のリンクを抽出する", () => {
    const html = `
      <a href="/docs/289719.html">議会議事録（令和6年）</a>
      <a href="/docs/65994.html">議会議事録（令和5年）</a>
      <a href="/docs/50506.html">議会議事録（令和4年）</a>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe("https://www.vill.yamagata.nagano.jp/docs/289719.html");
    expect(result[0]!.yearText).toBe("議会議事録（令和6年）");
    expect(result[1]!.url).toBe("https://www.vill.yamagata.nagano.jp/docs/65994.html");
    expect(result[2]!.url).toBe("https://www.vill.yamagata.nagano.jp/docs/50506.html");
  });

  it("平成・令和複合表記のリンクも抽出する", () => {
    const html = `
      <a href="/docs/2262.html">議会議事録（平成31年,令和元年）</a>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://www.vill.yamagata.nagano.jp/docs/2262.html");
    expect(result[0]!.yearText).toBe("議会議事録（平成31年,令和元年）");
  });

  it("/docs/ 以外のリンクは除外する", () => {
    const html = `
      <a href="/government/diet/minutes/">会議録一覧</a>
      <a href="/docs/289719.html">議会議事録（令和6年）</a>
      <a href="https://example.com/other.html">外部リンク</a>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://www.vill.yamagata.nagano.jp/docs/289719.html");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録なし</p>";
    expect(parseYearPageLinks(html)).toEqual([]);
  });
});

describe("parseYearPagePdfs", () => {
  it("本文 PDF リンクを抽出する（近年の日本語ファイル名形式）", () => {
    const html = `
      <a href="/fs/1/7/2/2/7/3/_/%E4%BB%A4%E5%92%8C%EF%BC%96%E5%B9%B4%E5%B1%B1%E5%BD%A2%E6%9D%91%E8%AD%B0%E4%BC%9A%E7%AC%AC%EF%BC%91%E5%9B%9E%E8%87%A8%E6%99%82%E4%BC%9A.pdf">令和6年山形村議会第1回臨時会 (PDF 232KB)</a>
      <a href="/fs/1/7/2/2/7/5/_/%E4%BB%A4%E5%92%8C%EF%BC%96%E5%B9%B4%E5%B1%B1%E5%BD%A2%E6%9D%91%E8%AD%B0%E4%BC%9A%E7%AC%AC%EF%BC%91%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A%EF%BC%88%E7%AC%AC%EF%BC%91%E5%8F%B7%EF%BC%89.pdf">令和6年山形村議会第1回定例会（第1号） (PDF 656KB)</a>
    `;

    const result = parseYearPagePdfs(html, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年山形村議会第1回臨時会");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.yamagata.nagano.jp/fs/1/7/2/2/7/3/_/%E4%BB%A4%E5%92%8C%EF%BC%96%E5%B9%B4%E5%B1%B1%E5%BD%A2%E6%9D%91%E8%AD%B0%E4%BC%9A%E7%AC%AC%EF%BC%91%E5%9B%9E%E8%87%A8%E6%99%82%E4%BC%9A.pdf",
    );
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.title).toBe("令和6年山形村議会第1回定例会（第1号）");
    expect(result[1]!.meetingType).toBe("plenary");
  });

  it("目次 PDF を除外する（mokuji を含むパス）", () => {
    const html = `
      <a href="/fs/6/6/3/3/_/teireikaidai1kaimokuji.pdf">平成31年山形村議会第1回定例会会議録目次</a>
      <a href="/fs/6/6/3/0/_/teireikaidai1kai1.pdf">平成31年山形村議会第1回定例会(第1号)</a>
    `;

    const result = parseYearPagePdfs(html, 2019);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("teireikaidai1kai1.pdf");
  });

  it("目次 PDF を除外する（日本語ファイル名に「目次」を含む場合）", () => {
    const html = `
      <a href="/fs/1/7/2/2/7/2/_/%E7%9B%AE%E6%AC%A1.pdf">令和6年山形村議会第1回臨時会会議録目次 (PDF 53.2KB)</a>
      <a href="/fs/1/7/2/2/7/3/_/kaigiroku.pdf">令和6年山形村議会第1回臨時会 (PDF 232KB)</a>
    `;

    const result = parseYearPagePdfs(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("kaigiroku.pdf");
  });

  it("一般質問総括表 PDF を除外する（ippansitumon を含むパス）", () => {
    const html = `
      <a href="/fs/6/6/3/4/_/teireikaidai1kaisoukatuhyo.pdf">平成31年第1回定例会一般質問総括表</a>
      <a href="/fs/6/6/3/1/_/teireikaidai1kai2.pdf">平成31年山形村議会第1回定例会(第2号)</a>
    `;

    const result = parseYearPagePdfs(html, 2019);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("teireikaidai1kai2.pdf");
  });

  it("一般質問総括表 PDF を除外する（日本語リンクテキストに「一般質問総括表」を含む場合）", () => {
    const html = `
      <a href="/fs/1/7/2/2/8/1/_/sokukatsu.pdf">令和6年第1回定例会一般質問総括表（第2号） (PDF 104KB)</a>
      <a href="/fs/1/7/2/2/7/7/_/kaigi2.pdf">令和6年山形村議会第1回定例会（第2号） (PDF 1.95MB)</a>
    `;

    const result = parseYearPagePdfs(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("kaigi2.pdf");
  });

  it("旧形式（過去のローマ字ファイル名）の PDF も抽出する", () => {
    const html = `
      <a href="/fs/6/6/2/8/_/rinjikaidai1kai.pdf">平成31年山形村議会第1回臨時会</a>
      <a href="/fs/6/6/3/0/_/teireikaidai1kai1.pdf">平成31年山形村議会第1回定例会(第1号)</a>
    `;

    const result = parseYearPagePdfs(html, 2019);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("平成31年山形村議会第1回臨時会");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[1]!.title).toBe("平成31年山形村議会第1回定例会(第1号)");
    expect(result[1]!.meetingType).toBe("plenary");
  });

  it("同じ URL が重複する場合は1件のみ返す", () => {
    const html = `
      <a href="/fs/1/2/3/_/kaigi.pdf">令和6年会議録</a>
      <a href="/fs/1/2/3/_/kaigi.pdf">令和6年会議録（再掲）</a>
    `;

    const result = parseYearPagePdfs(html, 2024);

    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録なし</p>";
    expect(parseYearPagePdfs(html, 2024)).toEqual([]);
  });
});
