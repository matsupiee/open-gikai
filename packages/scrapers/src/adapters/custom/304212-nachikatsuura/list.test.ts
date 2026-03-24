import { describe, expect, it } from "vitest";
import { parseListPage, buildTitleFromFileName } from "./list";

describe("buildTitleFromFileName", () => {
  it("令和6年3月定例会第1日のタイトルを組み立てる", () => {
    const title = buildTitleFromFileName("kaigirokuR06-03-1.pdf");
    expect(title).toBe("令和6年 第1回（3月）定例会 第1日");
  });

  it("令和6年9月定例会第7日のタイトルを組み立てる", () => {
    const title = buildTitleFromFileName("kaigirokuR06-09-7.pdf");
    expect(title).toBe("令和6年 第3回（9月）定例会 第7日");
  });

  it("令和6年12月定例会第3日のタイトルを組み立てる", () => {
    const title = buildTitleFromFileName("kaigirokuR06-12-3.pdf");
    expect(title).toBe("令和6年 第4回（12月）定例会 第3日");
  });

  it("令和元年（R01）を正しく処理する", () => {
    const title = buildTitleFromFileName("kaigirokuR01-03-1.pdf");
    expect(title).toBe("令和元年 第1回（3月）定例会 第1日");
  });

  it("マッチしないファイル名は null を返す", () => {
    const title = buildTitleFromFileName("unknown.pdf");
    expect(title).toBeNull();
  });
});

describe("parseListPage", () => {
  it("一覧ページから PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <div class="content">
          <p>令和6年度 会議録</p>
          <a href="/div/gikai/pdf/kaigiroku/kaigirokuR06-03-1.pdf">令和6年第1回定例会 第1日</a>
          <a href="/div/gikai/pdf/kaigiroku/kaigirokuR06-03-2.pdf">令和6年第1回定例会 第2日</a>
          <a href="/div/gikai/pdf/kaigiroku/kaigirokuR06-06-1.pdf">令和6年第2回定例会 第1日</a>
        </div>
      </body>
      </html>
    `;

    const sessions = parseListPage(html);

    expect(sessions).toHaveLength(3);
    expect(sessions[0]!.pdfUrl).toBe(
      "https://www.town.nachikatsuura.wakayama.jp/div/gikai/pdf/kaigiroku/kaigirokuR06-03-1.pdf",
    );
    expect(sessions[0]!.fileName).toBe("kaigirokuR06-03-1.pdf");
    expect(sessions[0]!.title).toBe("令和6年 第1回（3月）定例会 第1日");
    expect(sessions[0]!.heldOn).toBeNull();
    expect(sessions[0]!.meetingType).toBe("plenary");
    expect(sessions[1]!.pdfUrl).toBe(
      "https://www.town.nachikatsuura.wakayama.jp/div/gikai/pdf/kaigiroku/kaigirokuR06-03-2.pdf",
    );
    expect(sessions[2]!.pdfUrl).toBe(
      "https://www.town.nachikatsuura.wakayama.jp/div/gikai/pdf/kaigiroku/kaigirokuR06-06-1.pdf",
    );
  });

  it("重複 URL を除外する", () => {
    const html = `
      <a href="/div/gikai/pdf/kaigiroku/kaigirokuR06-03-1.pdf">第1日</a>
      <a href="/div/gikai/pdf/kaigiroku/kaigirokuR06-03-1.pdf">第1日（再掲）</a>
    `;

    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(1);
  });

  it("PDF リンクが存在しない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;
    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(0);
  });

  it("令和元年（R01）の PDF リンクを正しく処理する", () => {
    const html = `
      <a href="/div/gikai/pdf/kaigiroku/kaigirokuR01-03-1.pdf">令和元年第1回定例会 第1日</a>
    `;

    const sessions = parseListPage(html);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe("令和元年 第1回（3月）定例会 第1日");
  });
});
