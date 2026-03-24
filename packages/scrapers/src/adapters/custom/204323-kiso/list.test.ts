import { describe, expect, it } from "vitest";
import { parseCategoryPage } from "./list";

describe("parseCategoryPage", () => {
  it("h3 リンクから記事を抽出する", () => {
    const html = `
      <html>
      <body>
        <h3><a href="/gikai/kekka/100413/102357/" title="令和８年３月会議一般質問">令和８年３月会議一般質問</a></h3>
        <h3><a href="/gikai/kekka/100413/102319/" title="令和７年12月会議一般質問">令和７年12月会議一般質問</a></h3>
        <ul><li><a href="#">前のページへ</a></li><li><a href="#">次のページへ</a></li></ul>
      </body>
      </html>
    `;

    const { articles, hasNextPage } = parseCategoryPage(html, "100413");

    expect(articles).toHaveLength(2);
    expect(articles[0]!.categoryId).toBe("100413");
    expect(articles[0]!.articleId).toBe("102357");
    expect(articles[0]!.title).toBe("令和８年３月会議一般質問");
    expect(articles[1]!.articleId).toBe("102319");
    expect(hasNextPage).toBe(false);
  });

  it("次のページへリンクが有効な場合 hasNextPage が true", () => {
    const html = `
      <html>
      <body>
        <h3><a href="/gikai/kekka/100238/102359/">令和８年３月会議【議事日程・議案】</a></h3>
        <ul>
          <li><a href="#">前のページへ</a></li>
          <li><a href="/gikai/kekka/100238/?page=1">1</a></li>
          <li><a href="/gikai/kekka/100238/?page=2">次のページへ</a></li>
        </ul>
      </body>
      </html>
    `;

    const { articles, hasNextPage } = parseCategoryPage(html, "100238");

    expect(articles).toHaveLength(1);
    expect(articles[0]!.articleId).toBe("102359");
    expect(hasNextPage).toBe(true);
  });

  it("異なるカテゴリのリンクはスキップする", () => {
    const html = `
      <html>
      <body>
        <h3><a href="/gikai/kekka/100413/102357/">令和８年３月会議一般質問</a></h3>
        <h3><a href="/gikai/kekka/100238/102359/">令和８年３月会議【議事日程・議案】</a></h3>
      </body>
      </html>
    `;

    const { articles } = parseCategoryPage(html, "100413");

    expect(articles).toHaveLength(1);
    expect(articles[0]!.articleId).toBe("102357");
  });

  it("記事がない場合は空配列を返す", () => {
    const html = `<html><body><p>記事がありません</p></body></html>`;

    const { articles, hasNextPage } = parseCategoryPage(html, "100413");

    expect(articles).toHaveLength(0);
    expect(hasNextPage).toBe(false);
  });

  it("タイトルの余分な空白を除去する", () => {
    const html = `
      <html>
      <body>
        <h3><a href="/gikai/kekka/100413/102357/">  令和８年　３月会議  一般質問  </a></h3>
      </body>
      </html>
    `;

    const { articles } = parseCategoryPage(html, "100413");

    expect(articles[0]!.title).toBe("令和８年 ３月会議 一般質問");
  });
});
