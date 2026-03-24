import { describe, it, expect } from "vitest";
import { parseTopPage, parseMeetingPage } from "./list";

describe("parseTopPage", () => {
  it("nextpage.php?cd={ID}&syurui=2 リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/motegi/nextpage.php?cd=8461&syurui=2">令和7年9月　定例会　会議録</a></li>
          <li><a href="/motegi/nextpage.php?cd=8317&syurui=2">令和7年6月　定例会　会議録</a></li>
          <li><a href="/motegi/nextpage.php?cd=8066&syurui=2">令和6年9月　定例会　会議録</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.meetingId).toBe("8461");
    expect(result[0]!.title).toBe("令和7年9月 定例会 会議録");
    expect(result[0]!.meetingUrl).toBe(
      "https://www.town.motegi.tochigi.jp/motegi/nextpage.php?cd=8461&syurui=2"
    );
    expect(result[1]!.meetingId).toBe("8317");
    expect(result[2]!.meetingId).toBe("8066");
  });

  it("臨時会リンクも抽出する", () => {
    const html = `
      <a href="/motegi/nextpage.php?cd=8308&syurui=2">令和7年8月　臨時会　会議録</a>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年8月 臨時会 会議録");
  });

  it("&amp; エスケープ形式も抽出する", () => {
    const html = `
      <a href="/motegi/nextpage.php?cd=8461&amp;syurui=2">令和7年9月　定例会　会議録</a>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingId).toBe("8461");
  });

  it("重複する会議 ID を除外する", () => {
    const html = `
      <a href="/motegi/nextpage.php?cd=8461&syurui=2">令和7年9月　定例会　会議録</a>
      <a href="/motegi/nextpage.php?cd=8461&syurui=2">令和7年9月　定例会　会議録</a>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
  });

  it("syurui=2 以外のリンクはスキップする", () => {
    const html = `
      <a href="/motegi/nextpage.php?cd=17800&syurui=1">トップページ</a>
      <a href="/motegi/nextpage.php?cd=8461&syurui=2">令和7年9月　定例会　会議録</a>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.meetingId).toBe("8461");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseTopPage("")).toEqual([]);
  });
});

describe("parseMeetingPage", () => {
  it("/motegi/download/*.pdf リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/motegi/download/12345.pdf">令和6年12月3日会議録第1号.pdf</a></li>
          <li><a href="/motegi/download/12346.pdf">令和6年12月10日会議録第2号.pdf</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseMeetingPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.motegi.tochigi.jp/motegi/download/12345.pdf"
    );
    expect(result[0]!.pdfFileName).toBe("12345.pdf");
  });

  it("リンクテキストから開催日を抽出する（令和）", () => {
    const html = `
      <a href="/motegi/download/12345.pdf">令和6年12月　会議録第1号.pdf</a>
    `;

    // この場合、linkText には年月が含まれるが日がないため heldOn は null
    const result = parseMeetingPage(html);
    expect(result).toHaveLength(1);
    // 日まで指定されていなければ null
    expect(result[0]!.heldOn).toBeNull();
  });

  it("リンクテキストに完全な日付があれば heldOn を抽出する", () => {
    const html = `
      <a href="/motegi/download/12345.pdf">令和6年12月3日</a>
    `;

    const result = parseMeetingPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-12-03");
  });

  it("絶対 URL 形式の href も処理する", () => {
    const html = `
      <a href="https://www.town.motegi.tochigi.jp/motegi/download/99999.pdf">会議録</a>
    `;

    const result = parseMeetingPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.motegi.tochigi.jp/motegi/download/99999.pdf"
    );
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <a href="/motegi/download/12345.pdf">会議録第1号</a>
      <a href="/motegi/download/12345.pdf">会議録第1号（再掲）</a>
    `;

    const result = parseMeetingPage(html);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない HTML は空配列を返す", () => {
    const html = `<html><body><a href="/motegi/nextpage.php?cd=17800&syurui=1">トップ</a></body></html>`;
    expect(parseMeetingPage(html)).toEqual([]);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseMeetingPage("")).toEqual([]);
  });
});
