import { describe, expect, it } from "vitest";
import { hasNextPage, parseListPage } from "./list";

describe("parseListPage", () => {
  it("会議録を含む投稿リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <article>
          <h2 class="entry-title">
            <a href="https://www.vill.kouzushima.tokyo.jp/2024-1119/">
              神津島村議会定例会会議録(令和6年第3回)
            </a>
          </h2>
        </article>
        <article>
          <h2 class="entry-title">
            <a href="https://www.vill.kouzushima.tokyo.jp/2025-0301/">
              神津島村議会臨時会会議録(令和7年第1回)
            </a>
          </h2>
        </article>
      </body>
      </html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pageUrl).toBe(
      "https://www.vill.kouzushima.tokyo.jp/2024-1119/"
    );
    expect(meetings[0]!.title).toBe("神津島村議会定例会会議録(令和6年第3回)");
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[1]!.pageUrl).toBe(
      "https://www.vill.kouzushima.tokyo.jp/2025-0301/"
    );
    expect(meetings[1]!.title).toBe("神津島村議会臨時会会議録(令和7年第1回)");
    expect(meetings[1]!.year).toBe(2025);
  });

  it("会議録を含まない投稿はスキップする", () => {
    const html = `
      <html>
      <body>
        <article>
          <h2 class="entry-title">
            <a href="https://www.vill.kouzushima.tokyo.jp/2024-1001/">
              神津島村議会だより第20号
            </a>
          </h2>
        </article>
        <article>
          <h2 class="entry-title">
            <a href="https://www.vill.kouzushima.tokyo.jp/2024-1119/">
              神津島村議会定例会会議録(令和6年第3回)
            </a>
          </h2>
        </article>
      </body>
      </html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("神津島村議会定例会会議録(令和6年第3回)");
  });

  it("同じ URL の重複を除外する", () => {
    const html = `
      <html>
      <body>
        <a href="https://www.vill.kouzushima.tokyo.jp/2024-1119/">
          神津島村議会定例会会議録(令和6年第3回)
        </a>
        <a href="https://www.vill.kouzushima.tokyo.jp/2024-1119/">
          神津島村議会定例会会議録(令和6年第3回)
        </a>
      </body>
      </html>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("年号が解析できない投稿はスキップする", () => {
    const html = `
      <html>
      <body>
        <a href="https://www.vill.kouzushima.tokyo.jp/2024-1119/">
          神津島村議会会議録（年号なし）
        </a>
      </body>
      </html>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("投稿が0件の場合は空配列を返す", () => {
    const html = `<html><body><p>記事なし</p></body></html>`;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});

describe("hasNextPage", () => {
  it("次のページリンクがある場合は true を返す", () => {
    const html = `<a href="/category/gikai/page/2/" rel="next">次へ</a>`;
    expect(hasNextPage(html)).toBe(true);
  });

  it("次のページリンクがない場合は false を返す", () => {
    const html = `<p>最後のページです</p>`;
    expect(hasNextPage(html)).toBe(false);
  });

  it("class に next を含む要素がある場合は true を返す", () => {
    const html = `<a class="next page-numbers" href="/category/gikai/page/2/">2</a>`;
    expect(hasNextPage(html)).toBe(true);
  });
});
