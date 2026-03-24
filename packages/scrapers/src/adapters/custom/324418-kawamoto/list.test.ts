import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parseYearPage } from "./list";

describe("parseYearPageLinks", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/gyosei/town_administration/kawamoto_council/kaigiroku/7048">令和7年</a></li>
          <li><a href="/gyosei/town_administration/kawamoto_council/kaigiroku/6075">令和6年</a></li>
          <li><a href="/gyosei/town_administration/kawamoto_council/kaigiroku/h27gijiroku">平成27年</a></li>
          <li><a href="/about/">関係ないリンク</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseYearPageLinks(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(
      "https://www.town.shimane-kawamoto.lg.jp/gyosei/town_administration/kawamoto_council/kaigiroku/7048",
    );
    expect(urls[1]).toBe(
      "https://www.town.shimane-kawamoto.lg.jp/gyosei/town_administration/kawamoto_council/kaigiroku/6075",
    );
    expect(urls[2]).toBe(
      "https://www.town.shimane-kawamoto.lg.jp/gyosei/town_administration/kawamoto_council/kaigiroku/h27gijiroku",
    );
  });

  it("トップページ自体は除外する", () => {
    const html = `
      <ul>
        <li><a href="/gyosei/town_administration/kawamoto_council/kaigiroku/">トップ</a></li>
        <li><a href="/gyosei/town_administration/kawamoto_council/kaigiroku/7048">令和7年</a></li>
      </ul>
    `;

    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.shimane-kawamoto.lg.jp/gyosei/town_administration/kawamoto_council/kaigiroku/7048",
    );
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/gyosei/town_administration/kawamoto_council/kaigiroku/7048">令和7年</a></li>
        <li><a href="/gyosei/town_administration/kawamoto_council/kaigiroku/7048">令和7年（重複）</a></li>
      </ul>
    `;

    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(1);
  });

  it("年度別リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const urls = parseYearPageLinks(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会の PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <div class="com-section com-clearfix">
        <div class="contentBody">
          <h2>定例会</h2>
          <h3>第1回定例会</h3>
          <p>
            <a href="/files/original/abc123.pdf" target="_blank" rel="noopener">令和6年3月7日：初日</a>
            <br>
            <a href="/files/original/def456.pdf" target="_blank" rel="noopener">令和6年3月12日：最終日</a>
          </p>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shimane-kawamoto.lg.jp/files/original/abc123.pdf",
    );
    expect(meetings[0]!.title).toBe("第1回定例会 初日");
    expect(meetings[0]!.heldOn).toBe("2024-03-07");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.shimane-kawamoto.lg.jp/files/original/def456.pdf",
    );
    expect(meetings[1]!.title).toBe("第1回定例会 最終日");
    expect(meetings[1]!.heldOn).toBe("2024-03-12");
  });

  it("一般質問の議員名付きリンクを抽出する", () => {
    const html = `
      <div class="contentBody">
        <h2>定例会</h2>
        <h3>第1回定例会</h3>
        <p><strong>一般質問</strong></p>
        <p>
          <a href="/files/original/gq001.pdf" target="_blank" rel="noopener">令和6年3月12日：木村議員</a>
          <br>
          <a href="/files/original/gq002.pdf" target="_blank" rel="noopener">令和6年3月12日：本山議員</a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("第1回定例会 木村議員");
    expect(meetings[0]!.heldOn).toBe("2024-03-12");
    expect(meetings[1]!.title).toBe("第1回定例会 本山議員");
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <div class="contentBody">
        <h2>臨時会</h2>
        <h3>第3回臨時会</h3>
        <p>
          <a href="/files/original/rinji001.pdf" target="_blank" rel="noopener">令和6年6月3日：令和6年第3回臨時会</a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第3回臨時会 令和6年第3回臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-06-03");
  });

  it("対象年以外の PDF はスキップする", () => {
    const html = `
      <div class="contentBody">
        <h2>定例会</h2>
        <h3>第4回定例会</h3>
        <p>
          <a href="/files/original/old001.pdf" target="_blank" rel="noopener">令和5年12月7日：初日</a>
          <br>
          <a href="/files/original/new001.pdf" target="_blank" rel="noopener">令和6年3月7日：初日</a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-07");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <div class="contentBody">
        <h2>定例会</h2>
        <h3>第1回定例会</h3>
        <p>
          <a href="/files/original/dup001.pdf">令和6年3月7日：初日</a>
          <br>
          <a href="/files/original/dup001.pdf">令和6年3月7日：初日</a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
  });

  it(".contentBody がない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <div class="contentBody">
        <h2>定例会</h2>
        <p>会議録はありません。</p>
      </div>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("平成の日付も正しくパースする", () => {
    const html = `
      <div class="contentBody">
        <h2>定例会</h2>
        <h3>第1回定例会</h3>
        <p>
          <a href="/files/original/heisei001.pdf">平成30年3月8日：初日</a>
        </p>
      </div>
    `;

    const meetings = parseYearPage(html, 2018);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-03-08");
  });
});
