import { describe, expect, it } from "vitest";
import { parseListPage, extractYearFromTitle } from "./list";

describe("parseListPage", () => {
  it("実際のサイトと同じ相対 URL パターンを処理する", () => {
    const html = `
      <ul>
        <li><a href="2025-1119-1419-34.html">令和7年第3回定例会</a></li>
        <li><a href="files/7.9.pdf">令和7年第2回定例会</a></li>
        <li><a href="r3-12-16.html">令和3年第4回定例会</a></li>
      </ul>
    `;

    const links = parseListPage(html);

    expect(links).toHaveLength(3);

    expect(links[0]!.format).toBe("html");
    expect(links[0]!.title).toBe("令和7年第3回定例会");
    expect(links[0]!.url).toBe(
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/2025-1119-1419-34.html",
    );
    expect(links[0]!.meetingType).toBe("plenary");

    expect(links[1]!.format).toBe("pdf");
    expect(links[1]!.title).toBe("令和7年第2回定例会");
    expect(links[1]!.url).toBe(
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/files/7.9.pdf",
    );

    expect(links[2]!.format).toBe("html");
    expect(links[2]!.title).toBe("令和3年第4回定例会");
  });

  it("上位ディレクトリへのリンク（../../）はスキップする", () => {
    const html = `
      <ul>
        <li><a href="../../machi/index.html">まちの情報</a></li>
        <li><a href="2025-1119-1419-34.html">令和7年第3回定例会</a></li>
        <li><a href="../aramashi/index.html">議会のあらまし</a></li>
      </ul>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe("令和7年第3回定例会");
  });

  it("index.html はスキップする", () => {
    const html = `
      <ul>
        <li><a href="index.html">議会議事録</a></li>
        <li><a href="2025-1119-1419-34.html">令和7年第3回定例会</a></li>
      </ul>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe("令和7年第3回定例会");
  });

  it("リンクが存在しない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません</p></div>`;
    const links = parseListPage(html);
    expect(links).toHaveLength(0);
  });

  it("委員会リンクは committee に分類される", () => {
    const html = `
      <ul>
        <li><a href="2025-0101-0000-01.html">令和7年総務委員会</a></li>
      </ul>
    `;
    const links = parseListPage(html);
    expect(links[0]!.meetingType).toBe("committee");
  });

  it("臨時会は extraordinary に分類される", () => {
    const html = `
      <ul>
        <li><a href="2025-0101-0000-02.html">令和7年臨時会</a></li>
      </ul>
    `;
    const links = parseListPage(html);
    expect(links[0]!.meetingType).toBe("extraordinary");
  });

  it("平成形式（h28-1_1.html）のリンクも取得できる", () => {
    const html = `
      <ul>
        <li><a href="h28-1_1.html">平成28年第1回定例会（1日目）</a></li>
        <li><a href="h29-1_4.html">平成29年第1回定例会（4日目）</a></li>
      </ul>
    `;
    const links = parseListPage(html);
    expect(links).toHaveLength(2);
    expect(links[0]!.title).toBe("平成28年第1回定例会（1日目）");
    expect(links[0]!.format).toBe("html");
    expect(links[0]!.url).toBe(
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/h28-1_1.html",
    );
  });

  it("令和初期形式（R3-9-9.html）のリンクも取得できる", () => {
    const html = `
      <ul>
        <li><a href="R3-9-9.html">令和3年第3回定例会</a></li>
        <li><a href="r2-4-1.html">令和2年第4回定例会</a></li>
      </ul>
    `;
    const links = parseListPage(html);
    expect(links).toHaveLength(2);
    expect(links[0]!.format).toBe("html");
    expect(links[1]!.format).toBe("html");
  });

  it("平成 PDF ファイル（files/31.3.19.pdf）も取得できる", () => {
    const html = `
      <ul>
        <li><a href="files/31.3.19.pdf">平成31年第1回定例会（4日目）</a></li>
        <li><a href="files/1.12.18.pdf">令和元年第4回定例会（2日目）</a></li>
      </ul>
    `;
    const links = parseListPage(html);
    expect(links).toHaveLength(2);
    expect(links[0]!.format).toBe("pdf");
    expect(links[0]!.url).toBe(
      "https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/files/31.3.19.pdf",
    );
    expect(links[1]!.format).toBe("pdf");
  });

  it("平成 2018- 形式のリンクも取得できる", () => {
    const html = `
      <ul>
        <li><a href="2018-0814-1413-57.html">平成30年第2回定例会（1日目）</a></li>
      </ul>
    `;
    const links = parseListPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.format).toBe("html");
  });
});

describe("extractYearFromTitle", () => {
  it("令和7年第3回定例会 → 2025", () => {
    expect(extractYearFromTitle("令和7年第3回定例会")).toBe(2025);
  });

  it("令和元年第1回定例会 → 2019", () => {
    expect(extractYearFromTitle("令和元年第1回定例会")).toBe(2019);
  });

  it("平成28年第1回定例会 → 2016", () => {
    expect(extractYearFromTitle("平成28年第1回定例会")).toBe(2016);
  });

  it("平成31年第1回定例会 → 2019", () => {
    expect(extractYearFromTitle("平成31年第1回定例会")).toBe(2019);
  });

  it("全角数字も対応する", () => {
    expect(extractYearFromTitle("令和７年第３回定例会")).toBe(2025);
  });

  it("年号が含まれない文字列は null を返す", () => {
    expect(extractYearFromTitle("会議録")).toBeNull();
  });
});
