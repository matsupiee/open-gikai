import { describe, expect, it } from "vitest";
import { parseYearPageLinks, extractPdfRecords } from "./list";

describe("parseYearPageLinks", () => {
  it("年度別ページリンクを抽出する", () => {
    const html = `
      <html><body>
        <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/4165.html">令和6年議会議事録</a>
        <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/3608.html">令和5年議会議事録</a>
        <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/2901.html">令和4年議会議事録</a>
        <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/index.html">加美町議会</a>
      </body></html>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.pageId).toBe("4165");
    expect(links[0]!.yearText).toBe("令和6年議会議事録");
    expect(links[0]!.url).toBe("https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/4165.html");
    expect(links[1]!.pageId).toBe("3608");
    expect(links[2]!.pageId).toBe("2901");
  });

  it("プロトコル相対 URL も認識する", () => {
    const html = `
      <a href="//www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/4668.html">令和7年議会議事録</a>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.pageId).toBe("4668");
    expect(links[0]!.url).toBe("https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/4668.html");
  });

  it("同じページIDの重複を除外する", () => {
    const html = `
      <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/4165.html">令和6年議会議事録</a>
      <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/4165.html">令和6年議会議事録</a>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(1);
  });

  it("議事録以外のリンクは除外する", () => {
    const html = `
      <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/9999.html">議員名簿</a>
      <a href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/4165.html">令和6年議会議事録</a>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.pageId).toBe("4165");
  });
});

describe("extractPdfRecords", () => {
  it("定例会テーブルから PDF レコードを抽出する", () => {
    const html = `
      <div class="wysiwyg">
        <table>
          <caption>定例会</caption>
          <thead><tr><th>会議名</th><th>ファイル</th></tr></thead>
          <tbody>
            <tr>
              <td>第1回定例会 第1日（令和6年3月5日）</td>
              <td><a href="//www.town.kami.miyagi.jp/material/files/group/42/r06-01t-01-0305.pdf">会議録(PDFファイル:831.9KB)</a></td>
            </tr>
            <tr>
              <td>第1回定例会 第2日（令和6年3月6日）</td>
              <td><a href="//www.town.kami.miyagi.jp/material/files/group/42/r06-01t-02-0306.pdf">会議録(PDFファイル:805.6KB)</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const records = extractPdfRecords(html, "4165", 2024);

    expect(records).toHaveLength(2);
    expect(records[0]!.title).toBe("第1回定例会 第1日（令和6年3月5日）");
    expect(records[0]!.heldOn).toBe("2024-03-05");
    expect(records[0]!.pdfUrl).toBe("https://www.town.kami.miyagi.jp/material/files/group/42/r06-01t-01-0305.pdf");
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[0]!.yearPageId).toBe("4165");
    expect(records[1]!.heldOn).toBe("2024-03-06");
  });

  it("臨時会テーブル（caption が p 要素内）から抽出する", () => {
    const html = `
      <table>
        <caption><p>臨時会</p></caption>
        <thead><tr><th>会議名</th><th>ファイル</th></tr></thead>
        <tbody>
          <tr>
            <td>第1回臨時会（令和6年1月31日）</td>
            <td><a href="//www.town.kami.miyagi.jp/material/files/group/42/r06-01r-0131.pdf">会議録(PDFファイル:261.8KB)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const records = extractPdfRecords(html, "4165", 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.title).toBe("第1回臨時会（令和6年1月31日）");
    expect(records[0]!.heldOn).toBe("2024-01-31");
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("予算審査特別委員会テーブルから抽出する", () => {
    const html = `
      <table>
        <caption>予算審査特別委員会</caption>
        <thead><tr><th>会議名</th><th>ファイル</th></tr></thead>
        <tbody>
          <tr>
            <td>予算審査特別委員会&nbsp;第1日（令和6年3月8日）</td>
            <td><a href="//www.town.kami.miyagi.jp/material/files/group/42/r06-y-01-0308.pdf">会議録(PDFファイル:194KB)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const records = extractPdfRecords(html, "4165", 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.title).toBe("予算審査特別委員会 第1日（令和6年3月8日）");
    expect(records[0]!.heldOn).toBe("2024-03-08");
    expect(records[0]!.meetingType).toBe("committee");
  });

  it("PDF リンクがない行はスキップする", () => {
    const html = `
      <table>
        <caption>定例会</caption>
        <thead><tr><th>会議名</th><th>ファイル</th></tr></thead>
        <tbody>
          <tr>
            <td>第1回定例会 第1日（令和6年3月5日）</td>
            <td>準備中</td>
          </tr>
          <tr>
            <td>第1回定例会 第2日（令和6年3月6日）</td>
            <td><a href="//www.town.kami.miyagi.jp/material/files/group/42/r06-01t-02-0306.pdf">会議録(PDFファイル:805.6KB)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const records = extractPdfRecords(html, "4165", 2024);

    expect(records).toHaveLength(1);
    expect(records[0]!.heldOn).toBe("2024-03-06");
  });

  it("テーブルがない場合は空配列を返す", () => {
    const html = `<div>内容なし</div>`;

    const records = extractPdfRecords(html, "4165", 2024);

    expect(records).toHaveLength(0);
  });
});
