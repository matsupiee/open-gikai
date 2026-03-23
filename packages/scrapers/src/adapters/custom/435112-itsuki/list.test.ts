import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会リンクのみ抽出し、広報紙などはスキップする", () => {
    const html = `
      <html>
      <body>
      <div class="loadbox">
        <ul>
          <li>
            <a href="kiji0032032/index.html">五木村議会会議録（令和7年第1回定例会）</a>
          </li>
          <li>
            <a href="kiji0031916/index.html">五木村議会会議録（令和6年第3回定例会）</a>
          </li>
          <li>
            <a href="kiji0031800/index.html">議会広報紙「やまめ」第30号</a>
          </li>
        </ul>
      </div>
      </body>
      </html>
    `;

    const { items, nextPageUrl } = parseListPage(html);

    expect(items).toHaveLength(2);
    expect(items[0]!.articleUrl).toBe("https://www.vill.itsuki.lg.jp/kiji0032032/index.html");
    expect(items[0]!.title).toBe("五木村議会会議録（令和7年第1回定例会）");
    expect(items[1]!.articleUrl).toBe("https://www.vill.itsuki.lg.jp/kiji0031916/index.html");
    expect(nextPageUrl).toBeNull();
  });

  it("臨時会リンクも抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="kiji0031000/index.html">五木村議会会議録（令和5年第1回臨時会）</a>
        </li>
      </ul>
    `;

    const { items } = parseListPage(html);

    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("五木村議会会議録（令和5年第1回臨時会）");
  });

  it("rel=next リンクがある場合は nextPageUrl を返す", () => {
    const html = `
      <html>
      <head>
        <link rel="next" href="/list00107.html?page=2" />
      </head>
      <body>
        <ul>
          <li><a href="kiji0032032/index.html">五木村議会会議録（令和7年第1回定例会）</a></li>
        </ul>
      </body>
      </html>
    `;

    const { nextPageUrl } = parseListPage(html);

    expect(nextPageUrl).toBe("https://www.vill.itsuki.lg.jp/list00107.html?page=2");
  });

  it("絶対 URL のリンクも正規化する", () => {
    const html = `
      <ul>
        <li>
          <a href="https://www.vill.itsuki.lg.jp/kiji0032032/index.html">五木村議会会議録（令和6年第1回定例会）</a>
        </li>
      </ul>
    `;

    const { items } = parseListPage(html);

    expect(items).toHaveLength(1);
    expect(items[0]!.articleUrl).toBe("https://www.vill.itsuki.lg.jp/kiji0032032/index.html");
  });

  it("重複した記事 URL は除外する", () => {
    const html = `
      <ul>
        <li><a href="kiji0032032/index.html">五木村議会会議録（令和7年第1回定例会）</a></li>
        <li><a href="kiji0032032/index.html">五木村議会会議録（令和7年第1回定例会）</a></li>
      </ul>
    `;

    const { items } = parseListPage(html);

    expect(items).toHaveLength(1);
  });

  it("記事が0件の場合は空配列を返す", () => {
    const html = `<html><body><div class="loadbox"><ul></ul></div></body></html>`;

    const { items, nextPageUrl } = parseListPage(html);

    expect(items).toHaveLength(0);
    expect(nextPageUrl).toBeNull();
  });
});
