import { describe, expect, it } from "vitest";
import { parseYearFromLabel, parseTopPageLinks, parsePastLogLinks, parseYearPagePdfs } from "./list";
import { parseHeldOn } from "./shared";

describe("parseYearFromLabel", () => {
  it("令和年度を変換する", () => {
    expect(parseYearFromLabel("令和6年")).toBe(2024);
    expect(parseYearFromLabel("令和7年")).toBe(2025);
    expect(parseYearFromLabel("令和2年")).toBe(2020);
  });

  it("令和元年を変換する", () => {
    expect(parseYearFromLabel("令和元年")).toBe(2019);
    expect(parseYearFromLabel("平成31年・令和元年")).toBe(2019);
  });

  it("平成年度を変換する", () => {
    expect(parseYearFromLabel("平成30年")).toBe(2018);
    expect(parseYearFromLabel("平成15年")).toBe(2003);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseYearFromLabel("2024年")).toBeNull();
    expect(parseYearFromLabel("Unknown")).toBeNull();
    expect(parseYearFromLabel("")).toBeNull();
  });
});

describe("parseHeldOn", () => {
  it("YYYYMMDD形式を変換する", () => {
    expect(parseHeldOn("20241129")).toBe("2024-11-29");
    expect(parseHeldOn("20241205")).toBe("2024-12-05");
    expect(parseHeldOn("20240607")).toBe("2024-06-07");
  });

  it("Rnn.M.D形式を変換する", () => {
    expect(parseHeldOn("R06.9.3")).toBe("2024-09-03");
    expect(parseHeldOn("R06.9.30")).toBe("2024-09-30");
    expect(parseHeldOn("R06.10.1")).toBe("2024-10-01");
    expect(parseHeldOn("R07.11.28")).toBe("2025-11-28");
  });

  it("表記ゆれ（Rn.M.D）を変換する", () => {
    expect(parseHeldOn("R7.12.4")).toBe("2025-12-04");
    expect(parseHeldOn("R6.6.7")).toBe("2024-06-07");
  });

  it("解析できない場合はnullを返す", () => {
    expect(parseHeldOn("不明")).toBeNull();
    expect(parseHeldOn("")).toBeNull();
    expect(parseHeldOn("R06.9")).toBeNull();
  });
});

describe("parseTopPageLinks", () => {
  it("年度ページリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>市議会会議録</h2>
        <ul>
          <li><a href="./35933.html">令和７年</a></li>
          <li><a href="./32950.html">過去の会議録・議決結果</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseTopPageLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      year: 2025,
      url: "https://www.city.saga-kashima.lg.jp/main/35933.html",
    });
  });

  it("複数年度リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="./35933.html">令和７年</a></li>
        <li><a href="./35934.html">令和６年</a></li>
        <li><a href="./17875.html">平成31年・令和元年</a></li>
        <li><a href="./16151.html">平成30年</a></li>
      </ul>
    `;

    const result = parseTopPageLinks(html);

    expect(result).toHaveLength(4);
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.year).toBe(2024);
    expect(result[2]!.year).toBe(2019);
    expect(result[3]!.year).toBe(2018);
  });

  it("年度に対応しないリンクはスキップする", () => {
    const html = `
      <a href="./32950.html">過去の会議録・議決結果</a>
      <a href="./107.html">戻る</a>
      <a href="./35933.html">令和７年</a>
    `;

    const result = parseTopPageLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="./35933.html">令和７年</a>
      <a href="./35933.html">令和７年</a>
    `;

    const result = parseTopPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    expect(parseTopPageLinks(html)).toEqual([]);
  });
});

describe("parsePastLogLinks", () => {
  it("過去ログページから年度リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="./35934.html">令和6年</a></li>
        <li><a href="./28976.html">令和5年</a></li>
        <li><a href="./399.html">平成15年</a></li>
      </ul>
    `;

    const result = parsePastLogLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.url).toBe("https://www.city.saga-kashima.lg.jp/main/35934.html");
    expect(result[1]!.year).toBe(2023);
    expect(result[2]!.year).toBe(2003);
  });
});

describe("parseYearPagePdfs", () => {
  it("会議録PDFレコードを抽出する", () => {
    const html = `
      <html>
      <body>
        <div id="contents_0">
          <h2>令和6年12月定例会</h2>
          <ul>
            <li>目次・会期日程<a href="/site_files/file/gikai/kaigiroku/2024/202412%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E7%9B%AE%E6%AC%A1%EF%BC%89.pdf">（PDF185KB）</a></li>
            <li>11月29日（開会日）<a href="/site_files/file/gikai/kaigiroku/2024/20241129%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%8B%E4%BC%9A%EF%BC%89.pdf">（PDF276KB）</a></li>
            <li>12月5日（議案審議）<a href="/site_files/file/gikai/kaigiroku/2024/20241205%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E8%AD%B0%E6%A1%88%E5%AF%A9%E8%AD%B0%EF%BC%89.pdf">（PDF390KB）</a></li>
            <li>12月18日（閉会日）<a href="/site_files/file/gikai/kaigiroku/2024/20241218%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%89%E4%BC%9A%EF%BC%89.pdf">（PDF180KB）</a></li>
            <li>会議結果の概要<a href="/site_files/file/gikai/kaigiroku/2024/result.pdf">（PDF100KB）</a></li>
          </ul>
        </div>
        <div id="sub"></div>
      </body>
      </html>
    `;

    const result = parseYearPagePdfs(html, "/main/35934.html");

    // 目次と会議結果の概要は除外
    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和6年12月定例会 11月29日（開会日）");
    expect(result[0]!.heldOn).toBe("2024-11-29");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2024/20241129%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%8B%E4%BC%9A%EF%BC%89.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.yearPagePath).toBe("/main/35934.html");

    expect(result[1]!.title).toBe("令和6年12月定例会 12月5日（議案審議）");
    expect(result[1]!.heldOn).toBe("2024-12-05");
    expect(result[2]!.title).toBe("令和6年12月定例会 12月18日（閉会日）");
    expect(result[2]!.heldOn).toBe("2024-12-18");
  });

  it("R06.M.D 形式のファイル名を処理する", () => {
    const html = `
      <div id="contents_0">
        <h2>令和6年9月定例会</h2>
        <ul>
          <li>9月3日（開会日）<a href="/site_files/file/gikai/kaigiroku/2024/R06.9.3%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%8B%E4%BC%9A%EF%BC%89.pdf">（PDF276KB）</a></li>
          <li>10月3日（閉会日）<a href="/site_files/file/gikai/kaigiroku/2024/R06.10.3%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%89%E4%BC%9A%EF%BC%89.pdf">（PDF200KB）</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(html, "/main/35934.html");

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2024-09-03");
    expect(result[1]!.heldOn).toBe("2024-10-03");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <div id="contents_0">
        <h2>令和6年5月臨時会</h2>
        <ul>
          <li>5月1日（開会日）<a href="/site_files/file/gikai/kaigiroku/2024/R06.5.1%E3%80%80%E9%B9%BF%E5%B3%B6%E5%B8%82%EF%BC%88%E9%96%8B%E4%BC%9A%EF%BC%89.pdf">（PDF100KB）</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(html, "/main/35934.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<div id="contents_0"><ul><li>リンクなし</li></ul></div>`;
    const result = parseYearPagePdfs(html, "/main/35934.html");
    expect(result).toEqual([]);
  });

  it("目次・会議結果・結果書・会期日程を除外する", () => {
    const html = `
      <div id="contents_0">
        <h2>令和6年12月定例会</h2>
        <ul>
          <li>目次・会期日程<a href="/site_files/file/gikai/kaigiroku/2024/202412_mokuji.pdf">（PDF100KB）</a></li>
          <li>会期日程<a href="/site_files/file/gikai/kaigiroku/2024/kaiki.pdf">（PDF100KB）</a></li>
          <li>会議結果の概要<a href="/site_files/file/gikai/kaigiroku/2024/kekka.pdf">（PDF100KB）</a></li>
          <li>議決の一覧表<a href="/site_files/file/gikai/kaigiroku/2024/ichiran.pdf">（PDF100KB）</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPagePdfs(html, "/main/35934.html");
    expect(result).toEqual([]);
  });
});
