import { describe, expect, it } from "vitest";
import { parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("年度別一覧ページへのリンクを抽出する", () => {
    const html = `
      <a href="/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html">令和6年今帰仁村議会会議録</a>
      <a href="/pagtop/kakuka/gikai/2/2/2/gijiroku/5018.html">令和5年今帰仁村議会会議録</a>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.url).toBe(
      "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html",
    );
    expect(pages[0]!.year).toBe(2024);
    expect(pages[1]!.url).toBe(
      "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5018.html",
    );
    expect(pages[1]!.year).toBe(2023);
  });

  it("gijiroku 配下以外のリンクは無視する", () => {
    const html = `
      <a href="/pagtop/gyosei/songikai/1281.html">トップ</a>
      <a href="/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html">令和6年会議録</a>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2024);
  });

  it("令和元年を正しくパースする", () => {
    const html = `
      <a href="/pagtop/kakuka/gikai/2/2/2/gijiroku/1788.html">令和元年今帰仁村議会会議録</a>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2019);
  });

  it("平成30年を正しくパースする", () => {
    const html = `
      <a href="/pagtop/kakuka/gikai/2/2/2/gijiroku/heisei30nen/index.html">平成30年今帰仁村議会会議録</a>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.year).toBe(2018);
  });

  it("リンクが一件もない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const pages = parseTopPage(html);
    expect(pages).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <a href="//www.nakijin.jp/material/files/group/1/reiwa6nendai1kaiteireikai0305.pdf">令和6年第1回定例会3月5日</a>
      <a href="//www.nakijin.jp/material/files/group/1/reiwa6nendai1kaiteireikaimokujitou.pdf">令和6年第1回定例会目次・通告書</a>
    `;

    const meetings = parseYearPage(html, "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html", 2024);

    // 目次・通告書はスキップされる
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.fileUrl).toBe(
      "https://www.nakijin.jp/material/files/group/1/reiwa6nendai1kaiteireikai0305.pdf",
    );
    expect(meetings[0]!.title).toBe("令和6年第1回定例会3月5日");
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("定例会と臨時会を正しく検出する", () => {
    const html = `
      <a href="//www.nakijin.jp/material/files/group/1/reiwa6nendai2kairinjikai0801.pdf">令和6年第2回臨時会8月1日</a>
    `;

    const meetings = parseYearPage(html, "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html", 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("会期日程・議決結果をスキップする", () => {
    const html = `
      <a href="//www.nakijin.jp/material/files/group/1/reiwa6nendai1kaiteireikaikaikinitteitou.pdf">令和6年第1回定例会会期日程・議決結果</a>
      <a href="//www.nakijin.jp/material/files/group/1/reiwa6nendai1kaiteireikai0305.pdf">令和6年第1回定例会3月5日</a>
    `;

    const meetings = parseYearPage(html, "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html", 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年第1回定例会3月5日");
  });

  it("PDF ファイル名の MMDD から日付を抽出する", () => {
    const html = `
      <a href="//www.nakijin.jp/material/files/group/1/reiwa6nendai1kaiteireikai0305.pdf">第1回定例会</a>
    `;

    const meetings = parseYearPage(html, "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html", 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-05");
  });

  it("タイトルから和暦日付を抽出する", () => {
    const html = `
      <a href="//www.nakijin.jp/material/files/group/1/some.pdf">令和6年3月5日議事録</a>
    `;

    const meetings = parseYearPage(html, "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html", 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-05");
  });

  it("PDF 以外のリンクを無視する", () => {
    const html = `
      <a href="//www.nakijin.jp/material/files/group/1/doc.docx">ドキュメント</a>
      <a href="//www.nakijin.jp/material/files/group/1/reiwa6nendai1kaiteireikai0305.pdf">定例会</a>
    `;

    const meetings = parseYearPage(html, "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/5186.html", 2024);

    expect(meetings).toHaveLength(1);
  });

  it("リンクが一件もない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseYearPage(html, "https://example.com", 2024);
    expect(meetings).toHaveLength(0);
  });
});

describe("parseYearPage (令和2年フォーマット)", () => {
  it("タイトルに月日パターンがある場合に日付を抽出する", () => {
    const html = `
      <a href="//www.nakijin.jp/material/files/group/1/R2-1kaiteireikai309.pdf">令和2年第1回定例会3月9日</a>
    `;

    const meetings = parseYearPage(html, "https://www.nakijin.jp/pagtop/kakuka/gikai/2/2/2/gijiroku/2253.html", 2020);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2020);
    expect(meetings[0]!.heldOn).toBe("2020-03-09");
  });
});
