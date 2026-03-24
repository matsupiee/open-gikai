import { describe, expect, it } from "vitest";
import { parseListPage, extractYearFromLabel } from "./list";

describe("parseListPage", () => {
  it("HTML 形式と PDF 形式のリンクを分類する", () => {
    const html = `
      <div id="main_body">
        <h3>令和7年</h3>
        <ul>
          <li><a href="/gikai/minutes/kaigiroku/r07/r0712t.html">12月定例会議</a></li>
          <li><a href="/uploaded/attachment/12345.pdf">5月臨時会議</a></li>
        </ul>
        <h3>令和6年</h3>
        <ul>
          <li><a href="/gikai/minutes/kaigiroku/r06/r0612t.html">12月定例会議</a></li>
        </ul>
      </div>
    `;

    const links = parseListPage(html);

    expect(links).toHaveLength(3);

    expect(links[0]!.yearLabel).toBe("令和7年");
    expect(links[0]!.sessionName).toBe("12月定例会議");
    expect(links[0]!.format).toBe("html");
    expect(links[0]!.url).toBe(
      "https://www.town.kuriyama.hokkaido.jp/gikai/minutes/kaigiroku/r07/r0712t.html",
    );
    expect(links[0]!.meetingType).toBe("plenary");

    expect(links[1]!.sessionName).toBe("5月臨時会議");
    expect(links[1]!.format).toBe("pdf");
    expect(links[1]!.meetingType).toBe("extraordinary");

    expect(links[2]!.yearLabel).toBe("令和6年");
    expect(links[2]!.format).toBe("html");
  });

  it("対象外リンク（ページ内リンク等）はスキップする", () => {
    const html = `
      <div id="main_body">
        <h3>令和7年</h3>
        <ul>
          <li><a href="/site/gikai/other.html">その他</a></li>
          <li><a href="/gikai/minutes/kaigiroku/r07/r0706t.html">6月定例会議</a></li>
        </ul>
      </div>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.sessionName).toBe("6月定例会議");
  });

  it("リンクが存在しない場合は空配列を返す", () => {
    const html = `<div id="main_body"><p>会議録はありません</p></div>`;
    const links = parseListPage(html);
    expect(links).toHaveLength(0);
  });

  it("全角数字の年度ラベルもパースする", () => {
    const html = `
      <div id="main_body">
        <h3>令和７年</h3>
        <ul>
          <li><a href="/gikai/minutes/kaigiroku/r07/r0709t.html">9月定例会議</a></li>
        </ul>
      </div>
    `;

    const links = parseListPage(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.yearLabel).toBe("令和７年");
  });

  it("委員会リンクは committee に分類される", () => {
    const html = `
      <div id="main_body">
        <h3>令和7年</h3>
        <ul>
          <li><a href="/gikai/minutes/kaigiroku/r07/r0706i.html">6月総務委員会</a></li>
        </ul>
      </div>
    `;

    const links = parseListPage(html);
    expect(links[0]!.meetingType).toBe("committee");
  });
});

describe("extractYearFromLabel", () => {
  it("令和7年 → 2025", () => {
    expect(extractYearFromLabel("令和7年")).toBe(2025);
  });

  it("令和元年 → 2019", () => {
    expect(extractYearFromLabel("令和元年")).toBe(2019);
  });

  it("平成30年 → 2018", () => {
    expect(extractYearFromLabel("平成30年")).toBe(2018);
  });

  it("全角数字: 令和７年 → 2025", () => {
    expect(extractYearFromLabel("令和７年")).toBe(2025);
  });

  it("不正な文字列は null を返す", () => {
    expect(extractYearFromLabel("不明")).toBeNull();
  });
});
