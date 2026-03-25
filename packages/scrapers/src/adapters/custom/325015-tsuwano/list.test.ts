import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";
import { parseJapaneseDate, parseJapaneseYear } from "./shared";

describe("parseListPage", () => {
  it("令和6年の単一日程 PDF（h6 内 a タグ）を抽出する", () => {
    // 実際のページ構造: <h6><a href="...pdf">タイトル（PDF）</a></h6>
    const html = `
      <h3>令和６年</h3>
      <h6><a href="/www/contents/1707956534539/simple/060214.pdf">第１回２月臨時会（PDF／273KB）</a></h6>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("第１回２月臨時会");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.tsuwano.lg.jp/www/contents/1707956534539/simple/060214.pdf"
    );
    expect(results[0]!.filename).toBe("060214");
    expect(results[0]!.year).toBe(2024);
  });

  it("複数日程の定例会（h6 外の p タグ内 a タグ）を抽出する", () => {
    // 実際のページ構造: <h6><strong>会議名</strong></h6> + <p><a>各日</a></p>
    const html = `
      <h3>令和６年</h3>
      <h6><strong>第３回９月定例会</strong></h6>
      <p><a href="/www/contents/1707956534539/simple/060912.pdf">第１日目　令和６年９月12日（PDF／1247KB）</a></p>
      <p><a href="/www/contents/1707956534539/simple/060913.pdf">第２日目　令和６年９月13日（PDF／1126KB）</a></p>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("第３回９月定例会 第1日目");
    expect(results[0]!.heldOn).toBe("2024-09-12");
    expect(results[1]!.title).toBe("第３回９月定例会 第2日目");
    expect(results[1]!.heldOn).toBe("2024-09-13");
  });

  it("複数の年度を正しく処理する", () => {
    const html = `
      <h3>令和６年</h3>
      <h6><a href="/www/contents/1707956534539/simple/060214.pdf">第１回２月臨時会（PDF／273KB）</a></h6>
      <h3>令和５年</h3>
      <h6><a href="/www/contents/1707956534539/simple/202312.pdf">第４回12月定例会（PDF／900KB）</a></h6>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.year).toBe(2024);
    expect(results[1]!.year).toBe(2023);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;

    const results = parseListPage(html);
    expect(results).toHaveLength(0);
  });

  it("平成年代の PDF も正しく抽出する", () => {
    const html = `
      <h3>平成18年</h3>
      <h6><a href="/www/contents/1707956534539/simple/200606.pdf">第２回６月定例会（PDF／500KB）</a></h6>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.year).toBe(2006);
    expect(results[0]!.filename).toBe("200606");
  });

  it("gijirokuNN 形式のファイル名を正しく処理する", () => {
    const html = `
      <h3>令和５年</h3>
      <h6><a href="/www/contents/1707956534539/simple/gijiroku061.pdf">第１回３月定例会（PDF／800KB）</a></h6>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.filename).toBe("gijiroku061");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.tsuwano.lg.jp/www/contents/1707956534539/simple/gijiroku061.pdf"
    );
  });

  it("_N サフィックス付きのファイル名を正しく処理する", () => {
    const html = `
      <h3>令和３年</h3>
      <h6><strong>第１回３月定例会</strong></h6>
      <p><a href="/www/contents/1707956534539/simple/202103_1.pdf">第１日目（PDF／600KB）</a></p>
      <p><a href="/www/contents/1707956534539/simple/202103_2.pdf">第２日目（PDF／650KB）</a></p>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(2);
    expect(results[0]!.filename).toBe("202103_1");
    expect(results[1]!.filename).toBe("202103_2");
  });

  it("h3 の前に出現する PDF リンクを無視する", () => {
    const html = `
      <a href="/www/other.html">関係ないリンク</a>
      <h3>令和６年</h3>
      <h6><a href="/www/contents/1707956534539/simple/060214.pdf">第１回２月臨時会（PDF）</a></h6>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.year).toBe(2024);
  });

  it("単一日程の h6 内 PDF リンクは重複しない", () => {
    // h6 内の <a> が h6 外の <a> として二重にカウントされないことを確認
    const html = `
      <h3>令和６年</h3>
      <h6><a href="/www/contents/1707956534539/simple/060214.pdf">第１回２月臨時会（PDF／273KB）</a></h6>
      <h6><a href="/www/contents/1707956534539/simple/060226.pdf">第２回２月臨時会（PDF／561KB）</a></h6>
    `;

    const results = parseListPage(html);
    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("第１回２月臨時会");
    expect(results[1]!.title).toBe("第２回２月臨時会");
  });
});

describe("parseJapaneseYear", () => {
  it("令和6年を正しく変換する", () => {
    expect(parseJapaneseYear("令和６年")).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    expect(parseJapaneseYear("令和元年")).toBe(2019);
  });

  it("平成18年を正しく変換する", () => {
    expect(parseJapaneseYear("平成18年")).toBe(2006);
  });

  it("全角数字を正しく変換する", () => {
    expect(parseJapaneseYear("令和５年")).toBe(2023);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(parseJapaneseYear("コンテンツなし")).toBeNull();
  });
});

describe("parseJapaneseDate", () => {
  it("令和6年3月8日を正しく変換する", () => {
    expect(parseJapaneseDate("令和６年３月８日")).toBe("2024-03-08");
  });

  it("令和6年の半角日付を正しく変換する", () => {
    expect(parseJapaneseDate("令和6年9月10日")).toBe("2024-09-10");
  });

  it("平成30年の日付を正しく変換する", () => {
    expect(parseJapaneseDate("平成30年6月12日")).toBe("2018-06-12");
  });

  it("令和元年を正しく変換する", () => {
    expect(parseJapaneseDate("令和元年5月1日")).toBe("2019-05-01");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseJapaneseDate("日付情報なし")).toBeNull();
  });
});
