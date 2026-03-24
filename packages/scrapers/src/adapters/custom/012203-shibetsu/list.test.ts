import { describe, expect, it } from "vitest";
import { parseYearPage, parseIndexPage, getYearPageUrl } from "./list";

describe("getYearPageUrl", () => {
  it("令和6年（2024年）のページ URL を返す", () => {
    expect(getYearPageUrl(2024)).toBe(
      "https://www.city.shibetsu.lg.jp/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/6431.html",
    );
  });

  it("令和7年（2025年）のページ URL を返す", () => {
    expect(getYearPageUrl(2025)).toBe(
      "https://www.city.shibetsu.lg.jp/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/6642.html",
    );
  });

  it("定義されていない年は null を返す", () => {
    expect(getYearPageUrl(2018)).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <a href="/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/6431.html">令和6年</a>
      <a href="/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/4813.html">令和5年</a>
      <a href="/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/889.html">検索・閲覧について</a>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(
      "https://www.city.shibetsu.lg.jp/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/6431.html",
    );
    expect(urls[1]).toBe(
      "https://www.city.shibetsu.lg.jp/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/4813.html",
    );
  });

  it("889.html（説明ページ）は除外する", () => {
    const html = `
      <a href="/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/889.html">説明</a>
    `;

    const urls = parseIndexPage(html);
    expect(urls).toHaveLength(0);
  });

  it("重複 URL は一つにまとめる", () => {
    const html = `
      <a href="/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/6431.html">令和6年(1)</a>
      <a href="/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/6431.html">令和6年(2)</a>
    `;

    const urls = parseIndexPage(html);
    expect(urls).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  it("h2/h3 構造から PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年第3回定例会一般質問</h2>
      <h3>令和6年9月10日</h3>
      <p><a href="//www.city.shibetsu.lg.jp/material/files/group/36/R6-3tei-3.pdf">
        一般質問（9月10日）[PDFファイル／500KB]
      </a></p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.shibetsu.lg.jp/material/files/group/36/R6-3tei-3.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-09-10");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.title).toBe(
      "令和6年第3回定例会一般質問 令和6年9月10日",
    );
  });

  it("委員会のメタ情報を正しく識別する", () => {
    const html = `
      <h2>令和6年予算決算常任委員会（決算審査）</h2>
      <h3>令和6年11月5日</h3>
      <p><a href="//www.city.shibetsu.lg.jp/material/files/group/36/R6kessann.pdf">
        決算審査 [PDFファイル／300KB]
      </a></p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
    expect(meetings[0]!.heldOn).toBe("2024-11-05");
  });

  it("同一 h2 に複数の h3 セクションがある場合も抽出する", () => {
    const html = `
      <h2>令和6年第2回定例会一般質問</h2>
      <h3>令和6年6月11日</h3>
      <p><a href="//www.city.shibetsu.lg.jp/material/files/group/36/R6-2tei-1.pdf">
        一般質問 1日目 [PDFファイル／400KB]
      </a></p>
      <h3>令和6年6月12日</h3>
      <p><a href="//www.city.shibetsu.lg.jp/material/files/group/36/R6-2tei-2.pdf">
        一般質問 2日目 [PDFファイル／450KB]
      </a></p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-06-11");
    expect(meetings[1]!.heldOn).toBe("2024-06-12");
  });

  it("令和元年も正しくパースする", () => {
    const html = `
      <h2>令和元年第3回定例会一般質問</h2>
      <h3>令和元年9月10日</h3>
      <p><a href="//www.city.shibetsu.lg.jp/material/files/group/36/R1-3tei.pdf">
        一般質問 [PDFファイル／350KB]
      </a></p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-09-10");
  });

  it("https で始まる PDF URL もそのまま使う", () => {
    const html = `
      <h2>令和6年第1回定例会大綱質疑</h2>
      <h3>令和6年3月5日</h3>
      <p><a href="https://www.city.shibetsu.lg.jp/material/files/group/36/R6-1tei-1.pdf">
        大綱質疑 [PDFファイル／250KB]
      </a></p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.shibetsu.lg.jp/material/files/group/36/R6-1tei-1.pdf",
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<h2>令和6年第3回定例会</h2><h3>令和6年9月10日</h3><p>準備中</p>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("h2 がない場合もフォールバックで PDF を収集する", () => {
    const html = `
      <p><a href="//www.city.shibetsu.lg.jp/material/files/group/36/R6-3tei-3.pdf">
        一般質問 [PDFファイル／500KB]
      </a></p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.shibetsu.lg.jp/material/files/group/36/R6-3tei-3.pdf",
    );
  });
});
