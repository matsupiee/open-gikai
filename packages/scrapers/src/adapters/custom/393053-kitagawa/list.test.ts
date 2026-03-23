import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("議会事務局担当の定例会・臨時会記事を抽出する", () => {
    const html = `
      <div class="list">
        <p>
          <a href="/life/dtl.php?hdnKey=123">
            <span>令和7年第4回定例会 会期日程・審議結果</span>
            <span>議会事務局　2025年12月20日</span>
          </a>
        </p>
        <p>
          <a href="/life/dtl.php?hdnKey=456">
            <span>令和7年第3回臨時会 会期日程・審議結果</span>
            <span>議会事務局　2025年10月15日</span>
          </a>
        </p>
      </div>
    `;

    const articles = parseListPage(html);

    expect(articles).toHaveLength(2);
    expect(articles[0]!.hdnKey).toBe("123");
    expect(articles[0]!.title).toBe("令和7年第4回定例会 会期日程・審議結果");
    expect(articles[0]!.detailUrl).toBe(
      "https://www.kitagawamura.jp/life/dtl.php?hdnKey=123"
    );
    expect(articles[1]!.hdnKey).toBe("456");
    expect(articles[1]!.title).toBe("令和7年第3回臨時会 会期日程・審議結果");
  });

  it("議会事務局以外の担当はフィルタリングされる", () => {
    const html = `
      <div class="list">
        <p>
          <a href="/life/dtl.php?hdnKey=100">
            <span>令和7年第4回定例会 会期日程・審議結果</span>
            <span>議会事務局　2025年12月20日</span>
          </a>
        </p>
        <p>
          <a href="/life/dtl.php?hdnKey=200">
            <span>農業委員会定例会</span>
            <span>農業委員会事務局　2025年12月10日</span>
          </a>
        </p>
        <p>
          <a href="/life/dtl.php?hdnKey=300">
            <span>北川村地域おこし協力隊について</span>
            <span>総務課　2025年12月01日</span>
          </a>
        </p>
      </div>
    `;

    const articles = parseListPage(html);

    expect(articles).toHaveLength(1);
    expect(articles[0]!.hdnKey).toBe("100");
  });

  it("定例会・臨時会を含まないタイトルはフィルタリングされる", () => {
    const html = `
      <div class="list">
        <p>
          <a href="/life/dtl.php?hdnKey=100">
            <span>令和7年度 議会だより</span>
            <span>議会事務局　2025年12月20日</span>
          </a>
        </p>
        <p>
          <a href="/life/dtl.php?hdnKey=200">
            <span>令和7年第4回定例会 会期日程・審議結果</span>
            <span>議会事務局　2025年12月15日</span>
          </a>
        </p>
      </div>
    `;

    const articles = parseListPage(html);

    expect(articles).toHaveLength(1);
    expect(articles[0]!.hdnKey).toBe("200");
  });

  it("記事が0件の場合は空配列を返す", () => {
    const html = `<div class="list"></div>`;

    const articles = parseListPage(html);
    expect(articles).toHaveLength(0);
  });
});
