import { describe, expect, it } from "vitest";
import { extractSubPageLinks, extractPdfLinks, parseLinkText, parseDateFromText } from "./list";

describe("extractSubPageLinks", () => {
  it("インデックスページから末端ページへのリンクを抽出する", () => {
    const html = `
      <html><body>
        <ul>
          <li><a href="https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/17007.html">令和6年</a></li>
          <li><a href="https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/14030.html">令和5年</a></li>
          <li><a href="https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/index.html">一覧に戻る</a></li>
        </ul>
      </body></html>
    `;
    const indexUrl = "https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/index.html";

    const urls = extractSubPageLinks(html, indexUrl);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/17007.html");
    expect(urls[1]).toBe("https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/14030.html");
  });

  it("プロトコル相対URL（//）を正しく絶対URLに変換する", () => {
    const html = `
      <ul>
        <li><a href="//www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/17007.html">令和6年</a></li>
      </ul>
    `;
    const indexUrl = "https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/index.html";

    const urls = extractSubPageLinks(html, indexUrl);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/17007.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/17007.html">令和6年</a></li>
        <li><a href="https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/17007.html">令和6年（重複）</a></li>
      </ul>
    `;
    const indexUrl = "https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/index.html";

    const urls = extractSubPageLinks(html, indexUrl);
    expect(urls).toHaveLength(1);
  });

  it("index.html は除外される", () => {
    const html = `
      <ul>
        <li><a href="index.html">一覧</a></li>
        <li><a href="https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/17007.html">令和6年</a></li>
      </ul>
    `;
    const indexUrl = "https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/index.html";

    const urls = extractSubPageLinks(html, indexUrl);
    expect(urls).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const indexUrl = "https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/index.html";
    const urls = extractSubPageLinks(html, indexUrl);
    expect(urls).toHaveLength(0);
  });
});

describe("parseDateFromText", () => {
  it("単日の括弧付き日付を解析する", () => {
    const result = parseDateFromText("【会議録】令和6年第1回臨時会（5月17日）(PDFファイル: 623.5KB)");
    expect(result).toBe("2024-05-17");
  });

  it("会期（複数日）の場合は開始日を返す", () => {
    const result = parseDateFromText("【会議録】令和6年第2回定例会（6月10日～6月27日）(PDFファイル: 2.6MB)");
    expect(result).toBe("2024-06-10");
  });

  it("令和元年を正しく変換する", () => {
    const result = parseDateFromText("【会議録】令和元年第1回定例会（3月1日）");
    expect(result).toBe("2019-03-01");
  });

  it("平成を正しく変換する", () => {
    const result = parseDateFromText("【会議録】平成30年第1回定例会（3月5日）");
    expect(result).toBe("2018-03-05");
  });

  it("括弧内に完全な年月日がある場合", () => {
    const result = parseDateFromText("総務常任委員会（令和6年6月19日）");
    expect(result).toBe("2024-06-19");
  });

  it("日付情報がない場合は null を返す", () => {
    const result = parseDateFromText("【会議録】平成28年以前");
    expect(result).toBeNull();
  });
});

describe("parseLinkText", () => {
  const dummyPdfUrl = "https://www.city.seiyo.ehime.jp/material/files/group/34/test.pdf";

  it("本会議定例会のリンクテキストを解析する", () => {
    const result = parseLinkText(
      "【会議録】令和6年第2回定例会（6月10日～6月27日）(PDFファイル: 2.6MB)",
      dummyPdfUrl,
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和6年第2回定例会");
    expect(result!.heldOn).toBe("2024-06-10");
    expect(result!.pdfUrl).toBe(dummyPdfUrl);
  });

  it("本会議臨時会のリンクテキストを解析する", () => {
    const result = parseLinkText(
      "【会議録】令和6年第1回臨時会（5月17日）(PDFファイル: 623.5KB)",
      dummyPdfUrl,
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和6年第1回臨時会");
    expect(result!.heldOn).toBe("2024-05-17");
  });

  it("委員会のリンクテキストを解析する（括弧内に年月日）", () => {
    const result = parseLinkText(
      "総務常任委員会（令和6年6月19日）",
      dummyPdfUrl,
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("総務常任委員会");
    expect(result!.heldOn).toBe("2024-06-19");
  });

  it("令和5年の会議録を解析する", () => {
    const result = parseLinkText(
      "【会議録】令和5年第3回定例会（9月4日～9月22日）(PDFファイル: 1.5MB)",
      dummyPdfUrl,
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和5年第3回定例会");
    expect(result!.heldOn).toBe("2023-09-04");
  });
});

describe("extractPdfLinks", () => {
  it("/material/files/group/34/ を含む PDF リンクを抽出する", () => {
    const html = `
      <html><body>
        <h2>本会議 令和6年</h2>
        <p>
          <a href="//www.city.seiyo.ehime.jp/material/files/group/34/teireikaidainikai.pdf">
            【会議録】令和6年第2回定例会（6月10日～6月27日）(PDFファイル: 2.6MB)
          </a>
        </p>
        <p>
          <a href="//www.city.seiyo.ehime.jp/material/files/group/34/0601rinjikai.pdf">
            【会議録】令和6年第1回臨時会（5月17日）(PDFファイル: 623.5KB)
          </a>
        </p>
        <p><a href="/other/page.html">関係ないリンク</a></p>
      </body></html>
    `;

    const meetings = extractPdfLinks(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.seiyo.ehime.jp/material/files/group/34/teireikaidainikai.pdf",
    );
    expect(meetings[0]!.title).toBe("令和6年第2回定例会");
    expect(meetings[0]!.heldOn).toBe("2024-06-10");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.seiyo.ehime.jp/material/files/group/34/0601rinjikai.pdf",
    );
    expect(meetings[1]!.title).toBe("令和6年第1回臨時会");
    expect(meetings[1]!.heldOn).toBe("2024-05-17");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = extractPdfLinks(html);
    expect(meetings).toHaveLength(0);
  });

  it("委員会ページの PDF リンクも抽出できる", () => {
    const html = `
      <html><body>
        <h3>令和6年</h3>
        <p>
          <a href="//www.city.seiyo.ehime.jp/material/files/group/34/R6soumu1213.pdf">
            総務常任委員会（令和6年12月13日）(PDFファイル: 500KB)
          </a>
        </p>
      </body></html>
    `;

    const meetings = extractPdfLinks(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("総務常任委員会");
    expect(meetings[0]!.heldOn).toBe("2024-12-13");
  });
});
