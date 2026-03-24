import { describe, expect, it } from "vitest";
import {
  parseListPage,
  parseDetailPage,
  detectMeetingType,
} from "./list";

describe("parseListPage", () => {
  it("詳細ページリンクとタイトルを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/hotnews/detail/00016988.html">令和6年(2024年)第4回七飯町議会定例会会議録（12月9日～12日）</a></li>
          <li><a href="/hotnews/detail/00016991.html">令和7年(2025年)第2回七飯町議会定例会会議録（6月3日～6日）</a></li>
          <li><a href="/hotnews/detail/00008195.html">令和2年(2020年)第1回七飯町議会定例会会議録（3月2日）</a></li>
        </ul>
      </body>
      </html>
    `;

    const entries = parseListPage(html);

    expect(entries).toHaveLength(3);
    expect(entries[0]!.detailUrl).toBe(
      "https://www.town.nanae.hokkaido.jp/hotnews/detail/00016988.html",
    );
    expect(entries[0]!.title).toBe(
      "令和6年(2024年)第4回七飯町議会定例会会議録（12月9日～12日）",
    );
    expect(entries[0]!.year).toBe(2024);
    expect(entries[1]!.year).toBe(2025);
    expect(entries[2]!.year).toBe(2020);
  });

  it("重複するリンクは1件に絞る", () => {
    const html = `
      <a href="/hotnews/detail/00016988.html">令和6年(2024年)第4回七飯町議会定例会会議録（12月9日～12日）</a>
      <a href="/hotnews/detail/00016988.html">令和6年(2024年)第4回七飯町議会定例会会議録（再掲）</a>
    `;

    const entries = parseListPage(html);
    expect(entries).toHaveLength(1);
  });

  it("詳細ページリンクが存在しない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const entries = parseListPage(html);
    expect(entries).toHaveLength(0);
  });

  it("西暦が含まれないタイトルは year=null を返す", () => {
    const html = `
      <a href="/hotnews/detail/00006573.html">平成31年第1回七飯町議会定例会会議録</a>
    `;

    const entries = parseListPage(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.year).toBeNull();
  });
});

describe("parseDetailPage", () => {
  it("PDF リンクと開催日を抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和6年12月9日</h2>
        <p><a href="/hotnews/files/00016900/00016988/20250916124320.pdf">12月9日分会議録</a></p>
        <h2>令和6年12月10日</h2>
        <p><a href="/hotnews/files/00016900/00016988/20250916124321.pdf">12月10日分会議録</a></p>
      </body>
      </html>
    `;

    const items = parseDetailPage(
      html,
      "https://www.town.nanae.hokkaido.jp/hotnews/detail/00016988.html",
      "令和6年(2024年)第4回七飯町議会定例会会議録",
    );

    expect(items).toHaveLength(2);
    expect(items[0]!.pdfUrl).toBe(
      "https://www.town.nanae.hokkaido.jp/hotnews/files/00016900/00016988/20250916124320.pdf",
    );
    expect(items[0]!.heldOn).toBe("2024-12-09");
    expect(items[1]!.heldOn).toBe("2024-12-10");
  });

  it("平成年号の日付を正しく変換する", () => {
    const html = `
      <h2>平成31年3月4日</h2>
      <p><a href="/hotnews/files/00006500/00006573/20190304.pdf">3月4日分会議録</a></p>
    `;

    const items = parseDetailPage(
      html,
      "https://www.town.nanae.hokkaido.jp/hotnews/detail/00006573.html",
      "平成31年第1回七飯町議会定例会会議録",
    );

    expect(items).toHaveLength(1);
    expect(items[0]!.heldOn).toBe("2019-03-04");
  });

  it("開催日が見つからない場合は heldOn=null を返す", () => {
    const html = `
      <p><a href="/hotnews/files/00016900/00016988/20250916124320.pdf">会議録</a></p>
    `;

    const items = parseDetailPage(
      html,
      "https://www.town.nanae.hokkaido.jp/hotnews/detail/00016988.html",
      "令和6年(2024年)第4回七飯町議会定例会会議録",
    );

    expect(items).toHaveLength(1);
    expect(items[0]!.heldOn).toBeNull();
  });

  it("PDF が存在しない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録 PDF はありません</p></body></html>`;

    const items = parseDetailPage(
      html,
      "https://www.town.nanae.hokkaido.jp/hotnews/detail/00016988.html",
      "令和6年(2024年)第4回七飯町議会定例会会議録",
    );

    expect(items).toHaveLength(0);
  });

  it("臨時会の PDF を抽出する", () => {
    const html = `
      <h2>令和6年1月15日</h2>
      <p><a href="/hotnews/files/00015000/00015001/20240115.pdf">臨時会会議録</a></p>
    `;

    const items = parseDetailPage(
      html,
      "https://www.town.nanae.hokkaido.jp/hotnews/detail/00015001.html",
      "令和6年(2024年)第1回七飯町議会臨時会会議録",
    );

    expect(items).toHaveLength(1);
    expect(items[0]!.heldOn).toBe("2024-01-15");
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年(2024年)第4回七飯町議会定例会会議録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和6年(2024年)第1回七飯町議会臨時会会議録")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("令和6年総務常任委員会会議録")).toBe("committee");
  });
});
