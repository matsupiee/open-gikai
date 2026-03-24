import { describe, expect, it } from "vitest";
import { parseTopPage, parseSessionPage } from "./list";

describe("parseTopPage", () => {
  it("定例会ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <div class="contents_area" role="main" id="contents">
          <h2>会議録</h2>
          <ul class="nav">
            <li>
              <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/3">令和３年　会議録</a>
              <ul>
                <li>
                  <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/202112">令和３年第７回１２月定例会</a>
                </li>
              </ul>
            </li>
            <li>
              <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/4">令和４年　会議録</a>
              <ul>
                <li><a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/413">令和４年第１回３月定例会</a></li>
                <li><a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/426">令和４年第２回６月定例会</a></li>
              </ul>
            </li>
          </ul>
        </div>
      </body>
      </html>
    `;

    const links = parseTopPage(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.url).toBe("https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/202112");
    expect(links[0]!.title).toBe("令和３年第７回１２月定例会");
    expect(links[1]!.url).toBe("https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/413");
    expect(links[1]!.title).toBe("令和４年第１回３月定例会");
    expect(links[2]!.url).toBe("https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/426");
    expect(links[2]!.title).toBe("令和４年第２回６月定例会");
  });

  it("臨時会ページへのリンクも抽出する", () => {
    const html = `
      <html>
      <body>
        <div class="contents_area" id="contents">
          <ul class="nav">
            <li>
              <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/4">令和４年　会議録</a>
              <ul>
                <li><a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/438">令和４年第３回８月臨時会</a></li>
              </ul>
            </li>
          </ul>
        </div>
      </body>
      </html>
    `;

    const links = parseTopPage(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe("令和４年第３回８月臨時会");
  });

  it("年度リンク（会議録）は除外する", () => {
    const html = `
      <html>
      <body>
        <ul class="nav">
          <li>
            <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/3">令和３年　会議録</a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const links = parseTopPage(html);
    expect(links).toHaveLength(0);
  });

  it("noheji ドメイン外のリンクは除外する", () => {
    const html = `
      <html>
      <body>
        <ul class="nav">
          <li>
            <a href="https://example.com/定例会">令和４年第１回定例会</a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const links = parseTopPage(html);
    expect(links).toHaveLength(0);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const links = parseTopPage(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseSessionPage", () => {
  it("本会議 PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <div class="contents_area" role="main" id="contents">
          <h2>令和３年第７回１２月定例会</h2>
          <p><a href="https://www.town.noheji.aomori.jp/download_file/view/6249/2834">本会議会議録目次</a></p>
          <p><a href="https://www.town.noheji.aomori.jp/download_file/view/6250/2834">本会議第１号（１２月　８日）【開会、提案理由説明、委員会報告】</a></p>
          <p><a href="https://www.town.noheji.aomori.jp/download_file/view/6251/2834">本会議第２号（１２月　９日）【一般質問】</a></p>
        </div>
      </body>
      </html>
    `;
    const sessionTitle = "令和３年第７回１２月定例会";
    const sessionPageUrl = "https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/202112";

    const docs = parseSessionPage(html, sessionTitle, sessionPageUrl);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.sessionTitle).toBe("令和３年第７回１２月定例会");
    expect(docs[0]!.linkText).toBe("本会議第１号（１２月　８日）【開会、提案理由説明、委員会報告】");
    expect(docs[0]!.downloadUrl).toBe(
      "https://www.town.noheji.aomori.jp/download_file/view/6250/2834",
    );
    expect(docs[0]!.sessionPageUrl).toBe(sessionPageUrl);
    expect(docs[1]!.linkText).toBe("本会議第２号（１２月　９日）【一般質問】");
    expect(docs[1]!.downloadUrl).toBe(
      "https://www.town.noheji.aomori.jp/download_file/view/6251/2834",
    );
  });

  it("目次 PDF を除外する", () => {
    const html = `
      <html>
      <body>
        <div class="contents_area">
          <p><a href="/download_file/view/6249/2834">本会議会議録目次</a></p>
          <p><a href="/download_file/view/6250/2834">本会議第１号（１２月　８日）【開会】</a></p>
        </div>
      </body>
      </html>
    `;
    const docs = parseSessionPage(
      html,
      "令和３年第７回１２月定例会",
      "https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/202112",
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]!.linkText).toBe("本会議第１号（１２月　８日）【開会】");
  });

  it("相対 URL を絶対 URL に変換する", () => {
    const html = `
      <html>
      <body>
        <div class="contents_area">
          <p><a href="/download_file/view/6250/2834">本会議第１号（１２月　８日）【開会】</a></p>
        </div>
      </body>
      </html>
    `;
    const docs = parseSessionPage(
      html,
      "令和３年第７回１２月定例会",
      "https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/202112",
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]!.downloadUrl).toBe(
      "https://www.town.noheji.aomori.jp/download_file/view/6250/2834",
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const docs = parseSessionPage(
      html,
      "令和３年第７回１２月定例会",
      "https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/202112",
    );
    expect(docs).toHaveLength(0);
  });
});
