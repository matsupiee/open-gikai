import { describe, expect, it } from "vitest";
import { parsePageForPdfLinks, parsePastListPage } from "./list";

describe("parsePageForPdfLinks", () => {
  it("div.contents-left 内の p > a[href^='file/'] から PDF リンクを抽出する", () => {
    const html = `
      <div class="contents-left">
        <h2>会議録の閲覧</h2>
        <h4>一般質問</h4>
        <p><a href="file/gikai_kaigiroku-r07-13.pdf">令和7年第4回定例会(一般質問)大崎昭子議員【PDF】</a></p>
        <p><a href="file/gikai_kaigiroku-r07-11.pdf">令和7年第4回定例会(一般質問)斗賀高太郎議員【PDF】</a></p>
      </div>
    `;

    const records = parsePageForPdfLinks(html, 2025);

    expect(records).toHaveLength(2);
    expect(records[0]!.pdfUrl).toBe(
      "https://www.town.tohoku.lg.jp/chousei/gikai/file/gikai_kaigiroku-r07-13.pdf",
    );
    expect(records[0]!.year).toBe(2025);
    expect(records[0]!.session).toBe("第4回");
    expect(records[0]!.speakerName).toBe("大崎昭子");
    expect(records[1]!.speakerName).toBe("斗賀高太郎");
  });

  it("対象年以外のリンクはスキップされる", () => {
    const html = `
      <div class="contents-left">
        <p><a href="file/gikai_kaigiroku-r07-13.pdf">令和7年第4回定例会(一般質問)大崎昭子議員【PDF】</a></p>
        <p><a href="file/gikai_kaigiroku-r06-10.pdf">令和6年第4回定例会(一般質問)蛯澤正雄議員【PDF】</a></p>
      </div>
    `;

    const records2025 = parsePageForPdfLinks(html, 2025);
    const records2024 = parsePageForPdfLinks(html, 2024);

    expect(records2025).toHaveLength(1);
    expect(records2025[0]!.speakerName).toBe("大崎昭子");

    expect(records2024).toHaveLength(1);
    expect(records2024[0]!.speakerName).toBe("蛯澤正雄");
  });

  it("令和年号を西暦に変換する", () => {
    const html = `
      <div class="contents-left">
        <p><a href="file/gikai_kaigiroku-r06-10.pdf">令和6年第4回定例会(一般質問)蛯澤正雄議員【PDF】</a></p>
      </div>
    `;

    const records = parsePageForPdfLinks(html, 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.year).toBe(2024);
  });

  it("一般質問パターンに合致しないリンクはスキップされる", () => {
    const html = `
      <div class="contents-left">
        <p><a href="file/gikai_kaigiroku-r07-13.pdf">令和7年第4回定例会(一般質問)大崎昭子議員【PDF】</a></p>
        <p><a href="gikai_kaigiroku-01.html">過去の一般質問はこちら</a></p>
      </div>
    `;

    const records = parsePageForPdfLinks(html, 2025);

    expect(records).toHaveLength(1);
    expect(records[0]!.speakerName).toBe("大崎昭子");
  });

  it("データがない年は空配列を返す", () => {
    const html = `
      <div class="contents-left">
        <p><a href="file/gikai_kaigiroku-r07-13.pdf">令和7年第4回定例会(一般質問)大崎昭子議員【PDF】</a></p>
      </div>
    `;

    const records = parsePageForPdfLinks(html, 2020);

    expect(records).toHaveLength(0);
  });

  it("title から【PDF】を除去する", () => {
    const html = `
      <div class="contents-left">
        <p><a href="file/gikai_kaigiroku-r07-13.pdf">令和7年第4回定例会(一般質問)大崎昭子議員【PDF】</a></p>
      </div>
    `;

    const records = parsePageForPdfLinks(html, 2025);

    expect(records[0]!.title).not.toContain("【PDF】");
  });
});

describe("parsePastListPage", () => {
  it("div.contents-left 内の年度別ページリンクを収集する", () => {
    const html = `
      <div class="contents-left">
        <h2>過去の会議録の閲覧</h2>
        <h4>一般質問</h4>
        <p><a href="gikai_kaigiroku-05.html">令和5年</a></p>
        <p><a href="gikai_kaigiroku-06.html">令和6年</a></p>
      </div>
    `;

    const urls = parsePastListPage(html);

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(
      "https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-05.html",
    );
    expect(urls[1]).toBe(
      "https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-06.html",
    );
  });

  it("-01.html（過去一覧ページ自身）はスキップされる", () => {
    const html = `
      <div class="contents-left">
        <p><a href="gikai_kaigiroku-01.html">過去の一般質問はこちら</a></p>
        <p><a href="gikai_kaigiroku-05.html">令和5年</a></p>
      </div>
    `;

    const urls = parsePastListPage(html);

    expect(urls).not.toContain(
      "https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-01.html",
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-05.html",
    );
  });

  it("年度ページリンクがない場合は空配列を返す", () => {
    const html = `
      <div class="contents-left">
        <p>会議録はありません。</p>
      </div>
    `;

    const urls = parsePastListPage(html);

    expect(urls).toHaveLength(0);
  });
});
