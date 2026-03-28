import { describe, it, expect } from "vitest";
import { renderToStaticMarkup, type ReactElement } from "react-dom/server";

import { buildSnippet, highlightText } from "./helpers";

describe("buildSnippet", () => {
  it("200文字以下のコンテンツはそのまま返す", () => {
    const content = "短いテキスト";
    expect(buildSnippet(content, "テキスト")).toEqual({
      text: "短いテキスト",
      truncated: false,
    });
  });

  it("クエリが空文字の場合は先頭200文字で切る", () => {
    const content = "あ".repeat(300);
    const result = buildSnippet(content, "  ");
    expect(result.text).toBe("あ".repeat(200) + "...");
    expect(result.truncated).toBe(true);
  });

  it("マッチが先頭200文字以内にある場合は先頭200文字で切る", () => {
    const content = "予算" + "あ".repeat(300);
    const result = buildSnippet(content, "予算");
    expect(result.text).toBe(("予算" + "あ".repeat(300)).substring(0, 200) + "...");
    expect(result.truncated).toBe(true);
  });

  it("マッチが200文字以降にある場合はマッチ箇所を中心にスニペットを返す", () => {
    const content = "あ".repeat(300) + "予算" + "い".repeat(300);
    const result = buildSnippet(content, "予算");
    expect(result.truncated).toBe(true);
    expect(result.text.startsWith("...")).toBe(true);
    expect(result.text.endsWith("...")).toBe(true);
    expect(result.text).toContain("予算");
  });

  it("マッチがコンテンツ末尾付近の場合は末尾の ... が付かない", () => {
    const content = "あ".repeat(300) + "予算";
    const result = buildSnippet(content, "予算");
    expect(result.text).toContain("予算");
    expect(result.text.startsWith("...")).toBe(true);
    expect(result.text.endsWith("...")).toBe(false);
  });

  it("マッチしない場合は先頭200文字で切る", () => {
    const content = "あ".repeat(300);
    const result = buildSnippet(content, "予算");
    expect(result.text).toBe("あ".repeat(200) + "...");
    expect(result.truncated).toBe(true);
  });

  it("複数トークンで最初にマッチしたトークンの位置を基準にする", () => {
    const content = "あ".repeat(300) + "教育" + "い".repeat(100) + "予算" + "う".repeat(100);
    const result = buildSnippet(content, "予算 教育");
    expect(result.text).toContain("教育");
    expect(result.truncated).toBe(true);
  });

  it("正規表現の特殊文字を含むクエリでもエスケープされて動作する", () => {
    const content = "あ".repeat(300) + "test(value)" + "い".repeat(300);
    const result = buildSnippet(content, "test(value)");
    expect(result.text).toContain("test(value)");
  });
});

describe("highlightText", () => {
  it("マッチ箇所を<mark>タグで囲む", () => {
    const result = highlightText("予算について質問します", "予算");
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toBe(
      '<mark class="bg-yellow-200 rounded-sm">予算</mark>について質問します',
    );
  });

  it("複数トークンがそれぞれハイライトされる", () => {
    const result = highlightText("予算と教育について", "予算 教育");
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toBe(
      '<mark class="bg-yellow-200 rounded-sm">予算</mark>と<mark class="bg-yellow-200 rounded-sm">教育</mark>について',
    );
  });

  it("大文字小文字を区別せずマッチする", () => {
    const result = highlightText("Hello World", "hello");
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toBe(
      '<mark class="bg-yellow-200 rounded-sm">Hello</mark> World',
    );
  });

  it("マッチしない場合はプレーンテキストを返す", () => {
    const result = highlightText("予算について", "教育");
    expect(result).toBe("予算について");
  });

  it("クエリが空の場合はプレーンテキストを返す", () => {
    const result = highlightText("予算について", "  ");
    expect(result).toBe("予算について");
  });

  it("正規表現の特殊文字を含むクエリでもエスケープされて動作する", () => {
    const result = highlightText("test(value) is here", "test(value)");
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toBe(
      '<mark class="bg-yellow-200 rounded-sm">test(value)</mark> is here',
    );
  });

  it("同じトークンが複数回出現した場合すべてハイライトされる", () => {
    const result = highlightText("予算と予算の話", "予算");
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toBe(
      '<mark class="bg-yellow-200 rounded-sm">予算</mark>と<mark class="bg-yellow-200 rounded-sm">予算</mark>の話',
    );
  });
});
