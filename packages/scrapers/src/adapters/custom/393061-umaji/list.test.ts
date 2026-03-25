import { describe, it, expect } from "vitest";
import { parseCategoryPage, parsePostPage } from "./list";

describe("parseCategoryPage", () => {
  it("/about/parliament/{ID}/ 形式のリンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <ul>
          <li><a href="/about/parliament/3408/">議会の開催状況（令和6年度）</a></li>
          <li><a href="/about/parliament/3360/">議決の状況（令和6年度）</a></li>
          <li><a href="/about/parliament/574/">一般質問の状況</a></li>
        </ul>
      </div>
    `;

    const posts = parseCategoryPage(html);

    expect(posts).toHaveLength(3);
    expect(posts[0]!.postUrl).toBe("https://vill.umaji.lg.jp/about/parliament/3408/");
    expect(posts[0]!.postTitle).toBe("議会の開催状況（令和6年度）");
    expect(posts[1]!.postUrl).toBe("https://vill.umaji.lg.jp/about/parliament/3360/");
    expect(posts[1]!.postTitle).toBe("議決の状況（令和6年度）");
    expect(posts[2]!.postUrl).toBe("https://vill.umaji.lg.jp/about/parliament/574/");
    expect(posts[2]!.postTitle).toBe("一般質問の状況");
  });

  it("絶対 URL 形式のリンクも抽出する", () => {
    const html = `
      <div class="entry-content">
        <a href="https://vill.umaji.lg.jp/about/parliament/3408/">議会の開催状況</a>
      </div>
    `;

    const posts = parseCategoryPage(html);

    expect(posts).toHaveLength(1);
    expect(posts[0]!.postUrl).toBe("https://vill.umaji.lg.jp/about/parliament/3408/");
    expect(posts[0]!.postTitle).toBe("議会の開催状況");
  });

  it("重複する URL は1件のみ返す", () => {
    const html = `
      <div>
        <a href="/about/parliament/3408/">議会の開催状況</a>
        <a href="/about/parliament/3408/">議会の開催状況（再掲）</a>
      </div>
    `;

    const posts = parseCategoryPage(html);

    expect(posts).toHaveLength(1);
  });

  it("議会以外のリンクはフィルタリングされる", () => {
    const html = `
      <div>
        <a href="/about/parliament/3408/">議会ページ</a>
        <a href="/about/category/news/">ニュース</a>
        <a href="/contact/">お問い合わせ</a>
      </div>
    `;

    const posts = parseCategoryPage(html);

    expect(posts).toHaveLength(1);
    expect(posts[0]!.postUrl).toBe("https://vill.umaji.lg.jp/about/parliament/3408/");
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<div class="entry-content"><p>コンテンツなし</p></div>`;

    const posts = parseCategoryPage(html);
    expect(posts).toHaveLength(0);
  });
});

describe("parsePostPage", () => {
  it("wp-content/uploads/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <p><a href="https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc123.pdf">第1回臨時会（令和7年1月20日）</a></p>
        <p><a href="https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/03/def456.pdf">第2回定例会（令和7年3月6日）</a></p>
      </div>
    `;

    const entries = parsePostPage(html, "https://vill.umaji.lg.jp/about/parliament/3360/", "議決の状況（令和7年度）");

    expect(entries).toHaveLength(2);
    expect(entries[0]!.pdfUrl).toBe("https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc123.pdf");
    expect(entries[0]!.label).toBe("第1回臨時会（令和7年1月20日）");
    expect(entries[0]!.postUrl).toBe("https://vill.umaji.lg.jp/about/parliament/3360/");
    expect(entries[0]!.postTitle).toBe("議決の状況（令和7年度）");
    expect(entries[1]!.pdfUrl).toBe("https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/03/def456.pdf");
    expect(entries[1]!.label).toBe("第2回定例会（令和7年3月6日）");
  });

  it("PDF 以外のリンクは抽出しない", () => {
    const html = `
      <div class="entry-content">
        <a href="/about/parliament/3360/">戻る</a>
        <a href="https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc123.pdf">PDF リンク</a>
        <a href="/about/category/parliament/">カテゴリ</a>
      </div>
    `;

    const entries = parsePostPage(html, "https://vill.umaji.lg.jp/about/parliament/3360/", "議決の状況");

    expect(entries).toHaveLength(1);
    expect(entries[0]!.label).toBe("PDF リンク");
  });

  it("HTML タグやエンティティがラベルからクリーンアップされる", () => {
    const html = `
      <div class="entry-content">
        <p><a href="https://vill.umaji.lg.jp/wp/wp-content/uploads/2025/01/abc123.pdf">
          <span>第1回臨時会&amp;定例会</span>
        </a></p>
      </div>
    `;

    const entries = parsePostPage(html, "https://vill.umaji.lg.jp/about/parliament/3360/", "タイトル");

    expect(entries).toHaveLength(1);
    expect(entries[0]!.label).toBe("第1回臨時会&定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div class="entry-content"><p>PDF なし</p></div>`;

    const entries = parsePostPage(html, "https://vill.umaji.lg.jp/about/parliament/560/", "馬路村議会について");
    expect(entries).toHaveLength(0);
  });
});
