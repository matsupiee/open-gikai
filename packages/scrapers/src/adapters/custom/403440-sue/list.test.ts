import { describe, expect, it } from "vitest";
import { extractYearFromTitle, parseIndexPage, parseYearPage } from "./list";

describe("extractYearFromTitle", () => {
  it("令和6年を2024に変換する", () => {
    expect(extractYearFromTitle("会議録（令和6年）")).toBe(2024);
  });

  it("令和7年を2025に変換する", () => {
    expect(extractYearFromTitle("会議録（令和7年）")).toBe(2025);
  });

  it("令和元年を2019に変換する", () => {
    expect(extractYearFromTitle("会議録（令和元年）")).toBe(2019);
  });

  it("平成23年を2011に変換する", () => {
    expect(extractYearFromTitle("会議録(平成23年)")).toBe(2011);
  });

  it("年号を含まないテキストは null を返す", () => {
    expect(extractYearFromTitle("お知らせ")).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.sue.fukuoka.jp/gyosei/gikai/1/9200.html">会議録（令和7年）</a></li>
        <li><a href="https://www.town.sue.fukuoka.jp/gyosei/gikai/1/8033.html">会議録（令和6年）</a></li>
        <li><a href="https://www.town.sue.fukuoka.jp/gyosei/gikai/1/1890.html">会議録(平成23年)</a></li>
      </ul>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.yearPageUrl).toBe("https://www.town.sue.fukuoka.jp/gyosei/gikai/1/9200.html");
    expect(pages[0]!.year).toBe(2025);
    expect(pages[1]!.yearPageUrl).toBe("https://www.town.sue.fukuoka.jp/gyosei/gikai/1/8033.html");
    expect(pages[1]!.year).toBe(2024);
    expect(pages[2]!.year).toBe(2011);
  });

  it("年号を含まないリンクはスキップする", () => {
    const html = `
      <a href="https://www.town.sue.fukuoka.jp/gyosei/gikai/1/1234.html">お知らせ</a>
      <a href="https://www.town.sue.fukuoka.jp/gyosei/gikai/1/9200.html">会議録（令和7年）</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2025);
  });

  it("protocol-relative URL を正しく絶対 URL に変換する", () => {
    const html = `
      <a href="//www.town.sue.fukuoka.jp/gyosei/gikai/1/9200.html">会議録（令和7年）</a>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.yearPageUrl).toBe("https://www.town.sue.fukuoka.jp/gyosei/gikai/1/9200.html");
  });
});

describe("parseYearPage", () => {
  const pageUrl = "https://www.town.sue.fukuoka.jp/gyosei/gikai/1/9200.html";

  it("定例会の日ごと PDF リンクを抽出する", () => {
    const html = `
      <h4>定例会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/202503-0.pdf">
        第1回（3月）定例会会議録 (PDFファイル: 1.2MB)
      </a>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250303.pdf">
        3月3日（当初本会議） (PDFファイル: 422.0KB)
      </a>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250306.pdf">
        3月6日（中本会議） (PDFファイル: 350.0KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2025, pageUrl);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.sue.fukuoka.jp/material/files/group/46/20250303.pdf");
    expect(meetings[0]!.heldOn).toBe("2025-03-03");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[1]!.heldOn).toBe("2025-03-06");
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <h4>臨時会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250818.pdf">
        第2回（8月）臨時会会議録 (PDFファイル: 292.7KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2025, pageUrl);

    // 臨時会まとめ PDF には月日のみのリンクテキストがなく、和暦日付もないためスキップされる
    // ただし 8月18日を含むテキストがあれば抽出される
    // このケースでは「第2回（8月）臨時会会議録」には月日情報がないためスキップ
    expect(meetings).toHaveLength(0);
  });

  it("日付を含む臨時会 PDF リンクを抽出する", () => {
    const html = `
      <h4>臨時会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250818.pdf">
        8月18日（臨時会） (PDFファイル: 292.7KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2025, pageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-08-18");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.sue.fukuoka.jp/material/files/group/46/20250818.pdf");
  });

  it("定例会と臨時会が混在するページを正しく処理する", () => {
    const html = `
      <h4>定例会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250606.pdf">
        6月6日（当初本会議） (PDFファイル: 422.0KB)
      </a>
      <h4>臨時会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250818.pdf">
        8月18日（臨時会） (PDFファイル: 292.7KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2025, pageUrl);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.heldOn).toBe("2025-06-06");
    expect(meetings[1]!.meetingType).toBe("extraordinary");
    expect(meetings[1]!.heldOn).toBe("2025-08-18");
  });

  it("日付を含まないリンク（まとめ PDF）はスキップする", () => {
    const html = `
      <h4>定例会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/202503-0.pdf">
        第1回（3月）定例会会議録 (PDFファイル: 1.2MB)
      </a>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250303.pdf">
        3月3日（当初本会議） (PDFファイル: 422.0KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2025, pageUrl);

    // まとめ PDF はスキップ、日付付きは抽出
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-03");
  });

  it("protocol-relative URL を正しく絶対 URL に変換する", () => {
    const html = `
      <h4>定例会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250303.pdf">
        3月3日（当初本会議） (PDFファイル: 422.0KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2025, pageUrl);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.sue.fukuoka.jp/material/files/group/46/20250303.pdf",
    );
  });

  it("pageUrl が各 meeting に設定される", () => {
    const html = `
      <h4>定例会</h4>
      <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250303.pdf">
        3月3日（当初本会議） (PDFファイル: 422.0KB)
      </a>
    `;

    const meetings = parseYearPage(html, 2025, pageUrl);

    expect(meetings[0]!.pageUrl).toBe(pageUrl);
  });
});
