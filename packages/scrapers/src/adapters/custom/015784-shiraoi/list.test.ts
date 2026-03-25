import { describe, it, expect } from "vitest";
import { parseTopPageLinks, parseYearPage } from "./list";

describe("parseTopPageLinks", () => {
  it("トップページから年度別ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/docs/6603.html">令和7年</a></li>
        <li><a href="/docs/5585.html">令和6年</a></li>
        <li><a href="/docs/page2022031400015.html">令和4年</a></li>
      </ul>
    `;
    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(3);
    expect(links[0]).toBe("https://www.town.shiraoi.hokkaido.jp/docs/6603.html");
    expect(links[1]).toBe("https://www.town.shiraoi.hokkaido.jp/docs/5585.html");
    expect(links[2]).toBe("https://www.town.shiraoi.hokkaido.jp/docs/page2022031400015.html");
  });

  it("トップページ自身へのリンクは除外する", () => {
    const html = `
      <a href="/docs/page2014063000011.html">トップ</a>
      <a href="/docs/6603.html">令和7年</a>
    `;
    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]).toBe("https://www.town.shiraoi.hokkaido.jp/docs/6603.html");
  });

  it("重複するリンクは1件のみ返す", () => {
    const html = `
      <a href="/docs/5585.html">令和6年</a>
      <a href="/docs/5585.html">令和6年（再掲）</a>
    `;
    const links = parseTopPageLinks(html);
    expect(links).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const links = parseTopPageLinks("<p>コンテンツ</p>");
    expect(links).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("/fs/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/fs/5/8/3/7/6/_/2024.06.14_____.pdf">全員協議会</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shiraoi.hokkaido.jp/fs/5/8/3/7/6/_/2024.06.14_____.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-06-14");
  });

  it("リンクテキストから日付を解析する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/fs/5/8/3/7/6/_/gijiroku.pdf">令和6年3月定例会議録 令和6年3月4日</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
  });

  it("元年表記を正しくパースする", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/fs/5/0/0/0/1/_/r1_gijiroku.pdf">令和元年6月定例会議録 令和元年6月10日</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-10");
  });

  it("委員会は committee に分類される", () => {
    const html = `
      <table>
        <th>総務文教常任委員会</th>
        <tr>
          <td><a href="/fs/5/9/0/7/2/_/2025.04.24_________.pdf">2025.04.24_________.pdf</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
  });

  it("同じ PDF が複数回出現しても1件のみ返す", () => {
    const html = `
      <a href="/fs/5/8/3/7/6/_/2024.06.14_____.pdf">記録1</a>
      <a href="/fs/5/8/3/7/6/_/2024.06.14_____.pdf">記録1（再掲）</a>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("複数の PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/fs/1/2/3/4/5/_/2024.03.04_teireikai.pdf">3月定例会</a></td>
        </tr>
        <tr>
          <td><a href="/fs/2/3/4/5/6/_/2024.06.10_teireikai.pdf">6月定例会</a></td>
        </tr>
      </table>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
    expect(meetings[1]!.heldOn).toBe("2024-06-10");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<p>会議録は準備中です。</p>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });
});
