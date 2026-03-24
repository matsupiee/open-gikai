import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parseYearPage } from "./list";

describe("parseYearPageLinks", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul class="list00">
          <li><a href="/www/contents/1713521430737/index.html">令和6年会議録</a></li>
          <li><a href="/www/contents/1696990723442/index.html">令和5年会議録</a></li>
          <li><a href="/www/contents/1001000000015/index.html">過去の会議録（平成20年〜28年）</a></li>
          <li><a href="/about/">関係ないリンク</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseYearPageLinks(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(
      "https://www.town.ohnan.lg.jp/www/contents/1713521430737/index.html",
    );
    expect(urls[1]).toBe(
      "https://www.town.ohnan.lg.jp/www/contents/1696990723442/index.html",
    );
    expect(urls[2]).toBe(
      "https://www.town.ohnan.lg.jp/www/contents/1001000000015/index.html",
    );
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1713521430737/index.html">令和6年</a></li>
        <li><a href="/www/contents/1713521430737/index.html">令和6年（重複）</a></li>
      </ul>
    `;

    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(1);
  });

  it("年度別リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会の PDF リンクとメタ情報を抽出する（令和元年〜のページ形式）", () => {
    const html = `
      <div class="opt-item download-item fixHeight">
        <div class="tit"><h3>ダウンロード</h3></div>
        <div class="cont">
          <ul class="list00">
            <li>
              <a href="/www/contents/1713521430737/files/12gatuteireikaikaigiroku5.pdf">
                令和６年第１０回定例会（第５号）１２月１３日（PDF文書／380KB）
              </a>
            </li>
            <li>
              <a href="/www/contents/1713521430737/files/9kairinngikaikaigiroku.pdf">
                令和６年第９回臨時会　１１月１１日　（PDF文書／264KB）
              </a>
            </li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ohnan.lg.jp/www/contents/1713521430737/files/12gatuteireikaikaigiroku5.pdf",
    );
    expect(meetings[0]!.title).toBe("令和６年第１０回定例会（第５号）１２月１３日");
    expect(meetings[0]!.heldOn).toBe("2024-12-13");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.ohnan.lg.jp/www/contents/1713521430737/files/9kairinngikaikaigiroku.pdf",
    );
    expect(meetings[1]!.heldOn).toBe("2024-11-11");
  });

  it("過去の会議録（平成20年〜28年）の PDF リンクを抽出する", () => {
    const html = `
      <div class="contents">
        <p>
          <a href="/www/contents/1001000000015/simple/H28-9-5-12-16.pdf">
            平成28年第9回定例会第5日目12月16日（PDF／240KB）
          </a>
        </p>
        <p>
          <a href="/www/contents/1001000000015/simple/H28-8-11-11-2.pdf">
            平成28年第8回臨時会11月11日（PDF／223KB）
          </a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2016);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ohnan.lg.jp/www/contents/1001000000015/simple/H28-9-5-12-16.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2016-12-16");
    expect(meetings[1]!.heldOn).toBe("2016-11-11");
  });

  it("一般質問事項の PDF をスキップする", () => {
    const html = `
      <div class="opt-item download-item fixHeight">
        <div class="cont">
          <ul class="list00">
            <li>
              <a href="/www/contents/1001000000015/simple/H28-9-5-12-16.pdf">
                平成28年第9回定例会第5日目12月16日（PDF／240KB）
              </a>
            </li>
            <li>
              <a href="/www/contents/1001000000015/simple/H28-9-bouchou.pdf">
                平成28年第9回定例会一般質問事項（PDF／90KB）
              </a>
            </li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, 2016);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("H28-9-5-12-16.pdf");
  });

  it("対象年以外の PDF はスキップする", () => {
    const html = `
      <div class="opt-item download-item fixHeight">
        <div class="cont">
          <ul class="list00">
            <li>
              <a href="/www/contents/1696990723442/files/old.pdf">
                令和５年第１回定例会（第１号）３月７日（PDF文書／300KB）
              </a>
            </li>
            <li>
              <a href="/www/contents/1713521430737/files/new.pdf">
                令和６年第１回定例会（第１号）３月７日（PDF文書／310KB）
              </a>
            </li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-07");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <div class="opt-item download-item fixHeight">
        <div class="cont">
          <ul class="list00">
            <li>
              <a href="/www/contents/1713521430737/files/dup.pdf">
                令和６年第１回定例会（第１号）３月７日（PDF文書／300KB）
              </a>
            </li>
            <li>
              <a href="/www/contents/1713521430737/files/dup.pdf">
                令和６年第１回定例会（第１号）３月７日（PDF文書／300KB）
              </a>
            </li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("令和元年の日付を正しくパースする", () => {
    const html = `
      <div class="opt-item download-item fixHeight">
        <div class="cont">
          <ul class="list00">
            <li>
              <a href="/www/contents/1562205456141/files/reiwa1.pdf">
                令和元年第１回定例会（第１号）３月７日（PDF文書／250KB）
              </a>
            </li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-03-07");
  });

  it("平成31年の日付を正しくパースする", () => {
    const html = `
      <div class="opt-item download-item fixHeight">
        <div class="cont">
          <ul class="list00">
            <li>
              <a href="/www/contents/1550122165171/files/h31.pdf">
                平成３１年第１回定例会（第１号）３月８日（PDF文書／260KB）
              </a>
            </li>
          </ul>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-03-08");
  });
});
