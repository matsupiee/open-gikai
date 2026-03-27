import { describe, expect, it } from "vitest";
import {
  parseYearPageUrls,
  parseSessionLinks,
  parsePdfLinks,
  parseSessionTitle,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第1回")).toBe(2025);
    expect(parseWarekiYear("令和6年第4回")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成24年第1回")).toBe(2012);
    expect(parseWarekiYear("平成30年第3回")).toBe(2018);
  });

  it("全角数字を正しく変換する", () => {
    expect(parseWarekiYear("令和７年")).toBe(2025);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和7年第1回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和7年第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearPageUrls", () => {
  it("li.dir 内のリンクから年度ページ URL を抽出する", () => {
    const html = `
      <ul class="level1col2">
        <li class="dir"><a href="/gyoseijoho/gikai/kaigiroku/2335/index.html">令和7年</a></li>
        <li class="dir"><a href="/gyoseijoho/gikai/kaigiroku/6/index.html">令和6年</a></li>
        <li class="dir"><a href="/gyoseijoho/gikai/kaigiroku/r5gikai/index.html">令和5年</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(
      "https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/2335/index.html"
    );
    expect(result[1]).toBe(
      "https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/6/index.html"
    );
    expect(result[2]).toBe(
      "https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/r5gikai/index.html"
    );
  });

  it("重複を除外する", () => {
    const html = `
      <li class="dir"><a href="/gyoseijoho/gikai/kaigiroku/2335/index.html">令和7年</a></li>
      <li class="dir"><a href="/gyoseijoho/gikai/kaigiroku/2335/index.html">令和7年（重複）</a></li>
    `;

    const result = parseYearPageUrls(html);
    expect(result).toHaveLength(2);
  });

  it("li.dir がない場合は空配列を返す", () => {
    const html = "<ul><li><a href='/other/path.html'>その他</a></li></ul>";
    expect(parseYearPageUrls(html)).toEqual([]);
  });
});

describe("parseSessionLinks", () => {
  it("年度スラグと一致するセッションリンクを抽出する", () => {
    const html = `
      <ul class="level1col2">
        <li><a href="/gyoseijoho/gikai/kaigiroku/2335/2520.html">令和7年第1回</a></li>
        <li><a href="/gyoseijoho/gikai/kaigiroku/2335/2521.html">令和7年第2回</a></li>
        <li><a href="/gyoseijoho/gikai/kaigiroku/2335/index.html">一覧</a></li>
      </ul>
    `;

    const result = parseSessionLinks(html, "2335");

    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe(
      "https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/2335/2520.html"
    );
    expect(result[0]!.title).toBe("令和7年第1回");
    expect(result[1]!.url).toBe(
      "https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/2335/2521.html"
    );
  });

  it("index.html は除外される", () => {
    const html = `
      <a href="/gyoseijoho/gikai/kaigiroku/6/index.html">一覧</a>
      <a href="/gyoseijoho/gikai/kaigiroku/6/100.html">令和6年第1回</a>
    `;

    const result = parseSessionLinks(html, "6");

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年第1回");
  });

  it("異なるスラグのリンクは除外される", () => {
    const html = `
      <a href="/gyoseijoho/gikai/kaigiroku/2335/100.html">令和7年</a>
      <a href="/gyoseijoho/gikai/kaigiroku/6/200.html">令和6年</a>
    `;

    const result = parseSessionLinks(html, "2335");

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseSessionLinks(html, "2335")).toEqual([]);
  });
});

describe("parsePdfLinks", () => {
  it("a.pdf クラスのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a class="pdf" href="//www.town.tateshina.nagano.jp/material/files/group/3/R7teireikai1-01.pdf">3月4日本会議開会・町長招集挨拶・議案上程・提案説明 (PDFファイル: 711.8KB)</a></li>
        <li><a class="pdf" href="//www.town.tateshina.nagano.jp/material/files/group/3/R7teireikai1-02.pdf">3月7日一般質問 (PDFファイル: 727.9KB)</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe(
      "https://www.town.tateshina.nagano.jp/material/files/group/3/R7teireikai1-01.pdf"
    );
    expect(result[0]!.text).toBe(
      "3月4日本会議開会・町長招集挨拶・議案上程・提案説明 (PDFファイル: 711.8KB)"
    );
    expect(result[1]!.url).toBe(
      "https://www.town.tateshina.nagano.jp/material/files/group/3/R7teireikai1-02.pdf"
    );
  });

  it("プロトコル相対 URL に https: を付与する", () => {
    const html = `<a class="pdf" href="//www.town.tateshina.nagano.jp/material/files/group/3/test.pdf">テスト</a>`;
    const result = parsePdfLinks(html);
    expect(result[0]!.url).toBe(
      "https://www.town.tateshina.nagano.jp/material/files/group/3/test.pdf"
    );
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `<a class="pdf" href="https://www.town.tateshina.nagano.jp/material/files/group/8/74284643.pdf">旧 PDF</a>`;
    const result = parsePdfLinks(html);
    expect(result[0]!.url).toBe(
      "https://www.town.tateshina.nagano.jp/material/files/group/8/74284643.pdf"
    );
  });

  it("PDF 拡張子のすべてのリンクを抽出する", () => {
    const html = `
      <a href="/material/files/group/3/test.pdf">PDF リンク</a>
      <a class="pdf" href="//www.town.tateshina.nagano.jp/material/files/group/3/valid.pdf">有効</a>
    `;
    const result = parsePdfLinks(html);
    expect(result).toHaveLength(2);
    expect(result[0]!.text).toBe("PDF リンク");
    expect(result[1]!.text).toBe("有効");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });
});

describe("parseSessionTitle", () => {
  it("h1.title からタイトルと年度を抽出する", () => {
    const html = `<h1 class="title">令和7年第1回</h1>`;
    const result = parseSessionTitle(html);
    expect(result.rawTitle).toBe("令和7年第1回");
    expect(result.year).toBe(2025);
    expect(result.sessionNum).toBe(1);
  });

  it("全角数字を含むタイトルを処理する", () => {
    const html = `<h1 class="title">令和７年第１回</h1>`;
    const result = parseSessionTitle(html);
    expect(result.year).toBe(2025);
    expect(result.sessionNum).toBe(1);
  });

  it("平成のタイトルを処理する", () => {
    const html = `<h1 class="title">平成24年第3回</h1>`;
    const result = parseSessionTitle(html);
    expect(result.year).toBe(2012);
    expect(result.sessionNum).toBe(3);
  });

  it("h1.title がない場合は null を返す", () => {
    const html = "<div><p>会議録</p></div>";
    const result = parseSessionTitle(html);
    expect(result.year).toBeNull();
    expect(result.sessionNum).toBeNull();
    expect(result.rawTitle).toBe("");
  });
});
