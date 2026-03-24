import { describe, expect, it } from "vitest";
import { parseIndexUrls, parseYearIndexPage } from "./list";

describe("parseIndexUrls", () => {
  it("年度別インデックスページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/30128.html">令和7年町議会会議録</a></li>
        <li><a href="/site/gikai/26504.html">令和6年町議会会議録</a></li>
        <li><a href="/site/gikai/22676.html">令和5年町議会会議録</a></li>
      </ul>
    `;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.kihoku.ehime.jp/site/gikai/30128.html");
    expect(urls[1]).toBe("https://www.town.kihoku.ehime.jp/site/gikai/26504.html");
    expect(urls[2]).toBe("https://www.town.kihoku.ehime.jp/site/gikai/22676.html");
  });

  it("数値以外の ID を含むリンクは無視する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/30128.html">令和7年</a></li>
        <li><a href="/site/gikai/list17-364.html">一覧ページ</a></li>
      </ul>
    `;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://www.town.kihoku.ehime.jp/site/gikai/30128.html");
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="/site/gikai/30128.html">令和7年</a>
      <a href="/site/gikai/30128.html">令和7年（再掲）</a>
    `;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>リンクなし</p></body></html>`;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(0);
  });
});

describe("parseYearIndexPage", () => {
  it("定例会の PDF レコードを抽出する", () => {
    const html = `
      <h3>定例会</h3>
      <a href="/uploaded/life/30127_58166_misc.pdf">
        第1回鬼北町議会定例会（令和6年3月7日開催）[PDFファイル／300 KB]
      </a>
      <a href="/uploaded/life/30127_60001_misc.pdf">
        第2回鬼北町議会定例会（令和6年6月10日開催）[PDFファイル／250 KB]
      </a>
    `;

    const records = parseYearIndexPage(html);

    expect(records).toHaveLength(2);
    expect(records[0]!.pdfUrl).toBe(
      "https://www.town.kihoku.ehime.jp/uploaded/life/30127_58166_misc.pdf",
    );
    expect(records[0]!.heldOn).toBe("2024-03-07");
    expect(records[0]!.meetingKind).toBe("定例会");
    expect(records[0]!.sessionNumber).toBe(1);
    expect(records[1]!.heldOn).toBe("2024-06-10");
    expect(records[1]!.sessionNumber).toBe(2);
  });

  it("臨時会の PDF レコードを抽出する", () => {
    const html = `
      <h3>臨時会</h3>
      <a href="/uploaded/life/30127_59000_misc.pdf">
        第1回鬼北町議会臨時会（令和6年1月15日開催）[PDFファイル／150 KB]
      </a>
    `;

    const records = parseYearIndexPage(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingKind).toBe("臨時会");
    expect(records[0]!.heldOn).toBe("2024-01-15");
  });

  it("定例会と臨時会が混在する場合を正しく分類する", () => {
    const html = `
      <h3>定例会</h3>
      <a href="/uploaded/life/30127_58166_misc.pdf">
        第1回鬼北町議会定例会（令和6年3月7日開催）[PDFファイル／300 KB]
      </a>
      <h3>臨時会</h3>
      <a href="/uploaded/life/30127_59000_misc.pdf">
        第1回鬼北町議会臨時会（令和6年1月15日開催）[PDFファイル／150 KB]
      </a>
    `;

    const records = parseYearIndexPage(html);

    expect(records).toHaveLength(2);
    expect(records[0]!.meetingKind).toBe("定例会");
    expect(records[1]!.meetingKind).toBe("臨時会");
  });

  it("PDF リンク以外のリンクは無視する", () => {
    const html = `
      <h3>定例会</h3>
      <a href="/uploaded/life/30127_58166_misc.pdf">
        第1回鬼北町議会定例会（令和6年3月7日開催）[PDFファイル／300 KB]
      </a>
      <a href="/site/gikai/26504.html">年度インデックス</a>
    `;

    const records = parseYearIndexPage(html);

    expect(records).toHaveLength(1);
  });

  it("h3 が定例会・臨時会以外のセクションは無視する", () => {
    const html = `
      <h3>お知らせ</h3>
      <a href="/uploaded/life/30127_58166_misc.pdf">
        第1回鬼北町議会定例会（令和6年3月7日開催）[PDFファイル／300 KB]
      </a>
      <h3>定例会</h3>
      <a href="/uploaded/life/30127_60000_misc.pdf">
        第3回鬼北町議会定例会（令和6年9月10日開催）[PDFファイル／300 KB]
      </a>
    `;

    const records = parseYearIndexPage(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingKind).toBe("定例会");
  });

  it("平成年号を正しく変換する", () => {
    const html = `
      <h3>定例会</h3>
      <a href="/uploaded/life/14360_32858_misc.pdf">
        第1回鬼北町議会定例会（平成31年3月6日開催）[PDFファイル／300 KB]
      </a>
    `;

    const records = parseYearIndexPage(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.heldOn).toBe("2019-03-06");
  });

  it("PDF がない場合は空配列を返す", () => {
    const html = `<html><body><h3>定例会</h3><p>該当なし</p></body></html>`;

    const records = parseYearIndexPage(html);

    expect(records).toHaveLength(0);
  });
});
