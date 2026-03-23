import { describe, expect, it } from "vitest";
import { parseDetailPage, parseListPage } from "./list";

describe("parseListPage", () => {
  it("年度別一覧ページから会議録リンクを抽出する", () => {
    const html = `
      <div class="page-list">
        <ul>
          <li>
            <a href="https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5431.html">令和6年  第1回(1月)臨時会会議録</a>
          </li>
          <li>
            <a href="https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5607.html">令和6年  第1回(3月)定例会会議録</a>
          </li>
          <li>
            <a href="https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5730.html">令和6年  第2回(6月)定例会会議録</a>
          </li>
        </ul>
      </div>
    `;

    const pages = parseListPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.title).toBe("令和6年 第1回(1月)臨時会会議録");
    expect(pages[0]!.pageUrl).toBe(
      "https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5431.html",
    );
    expect(pages[1]!.title).toBe("令和6年 第1回(3月)定例会会議録");
    expect(pages[2]!.title).toBe("令和6年 第2回(6月)定例会会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="https://example.com/1234.html">お知らせ</a>
      <a href="https://example.com/5431.html">令和6年 第1回(1月)臨時会会議録</a>
    `;

    const pages = parseListPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe("令和6年 第1回(1月)臨時会会議録");
  });

  it("パンくずリストの「会議録」リンクは数値IDでないためスキップされる", () => {
    const html = `
      <a href="https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/index.html">会議録</a>
      <a href="https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5431.html">令和6年 第1回(1月)臨時会会議録</a>
    `;

    const pages = parseListPage(html);
    expect(pages).toHaveLength(1);
  });

  it("protocol-relative URL を正しく処理する", () => {
    const html = `
      <a href="//www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5431.html">令和6年 第1回(1月)臨時会会議録</a>
    `;

    const pages = parseListPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.pageUrl).toBe(
      "https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5431.html",
    );
  });
});

describe("parseDetailPage", () => {
  it("個別ページから PDF リンクと開催日を抽出する（単一PDF）", () => {
    const html = `
      <div>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.hirokawa.fukuoka.jp/material/files/group/37/R060105.pdf">
            令和6年 第1回（1月）臨時会会議録 令和6年1月5日 (PDFファイル: 322.1KB)
          </a>
        </p>
      </div>
    `;

    const meetings = parseDetailPage(
      html,
      "令和6年 第1回(1月)臨時会会議録",
      "https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5431.html",
    );

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hirokawa.fukuoka.jp/material/files/group/37/R060105.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-01-05");
    expect(meetings[0]!.title).toBe("令和6年 第1回(1月)臨時会会議録");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("個別ページから複数の PDF リンクを抽出する", () => {
    const html = `
      <div>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.hirokawa.fukuoka.jp/material/files/group/37/060304.pdf">
            令和6年 第1回（3月）定例会会議録 令和6年3月4日 (PDFファイル: 761.5KB)
          </a>
        </p>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.hirokawa.fukuoka.jp/material/files/group/37/060305.pdf">
            令和6年 第1回（3月）定例会会議録 令和6年3月5日 (PDFファイル: 462.7KB)
          </a>
        </p>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.hirokawa.fukuoka.jp/material/files/group/37/060321.pdf">
            令和6年 第1回（3月）定例会会議録 令和6年3月21日 (PDFファイル: 316.8KB)
          </a>
        </p>
      </div>
    `;

    const meetings = parseDetailPage(
      html,
      "令和6年 第1回(3月)定例会会議録",
      "https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/5_4/5607.html",
    );

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
    expect(meetings[1]!.heldOn).toBe("2024-03-05");
    expect(meetings[2]!.heldOn).toBe("2024-03-21");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[1]!.meetingType).toBe("plenary");
  });

  it("日付を含まない PDF リンクはスキップする", () => {
    const html = `
      <p class="file-link-item">
        <a class="pdf" href="//www.town.hirokawa.fukuoka.jp/material/files/group/37/060304.pdf">
          令和6年 第1回（3月）定例会会議録 令和6年3月4日 (PDFファイル: 761.5KB)
        </a>
      </p>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.hirokawa.fukuoka.jp/material/files/group/37/shiryou.pdf">
          資料一覧 (PDFファイル: 100KB)
        </a>
      </p>
    `;

    const meetings = parseDetailPage(
      html,
      "令和6年 第1回(3月)定例会会議録",
      "https://example.com/5607.html",
    );

    expect(meetings).toHaveLength(1);
  });
});
