import { describe, it, expect } from "vitest";
import { parseYearListPage, parseDetailPage } from "./list";

describe("parseYearListPage", () => {
  it("定例会・臨時会リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="r6dai7teireikai.html">令和６年第７回那珂川町議会定例会（１２月）会議録</a></li>
          <li><a href="r6dai6teireikai.html">令和６年第６回那珂川町議会定例会（９月）会議録</a></li>
          <li><a href="r6rinji1.html">令和６年第１回那珂川町議会臨時会（２月）会議録</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseYearListPage(html, 2024);

    expect(result).toHaveLength(3);
    expect(result[0]!.detailUrl).toBe(
      "https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/r6dai7teireikai.html"
    );
    expect(result[0]!.title).toBe(
      "令和６年第７回那珂川町議会定例会（１２月）会議録"
    );
    expect(result[1]!.title).toBe(
      "令和６年第６回那珂川町議会定例会（９月）会議録"
    );
    expect(result[2]!.title).toBe(
      "令和６年第１回那珂川町議会臨時会（２月）会議録"
    );
  });

  it("絶対 URL の href も処理する", () => {
    const html = `
      <a href="https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/r6dai7teireikai.html">令和６年第７回那珂川町議会定例会（１２月）会議録</a>
    `;

    const result = parseYearListPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.detailUrl).toBe(
      "https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/r6dai7teireikai.html"
    );
  });

  it("絶対パス（/から始まる）の href も処理する", () => {
    const html = `
      <a href="/05gikai/kaigiroku/2024/r6dai7teireikai.html">令和６年第７回那珂川町議会定例会（１２月）会議録</a>
    `;

    const result = parseYearListPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.detailUrl).toBe(
      "https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/r6dai7teireikai.html"
    );
  });

  it("重複する URL を除外する", () => {
    const html = `
      <a href="r6dai7teireikai.html">令和６年第７回那珂川町議会定例会（１２月）会議録</a>
      <a href="r6dai7teireikai.html">令和６年第７回那珂川町議会定例会（１２月）会議録</a>
    `;

    const result = parseYearListPage(html, 2024);
    expect(result).toHaveLength(1);
  });

  it("定例会・臨時会以外のリンクはスキップする", () => {
    const html = `
      <a href="index.html">会議録一覧に戻る</a>
      <a href="r6dai7teireikai.html">令和６年第７回那珂川町議会定例会（１２月）会議録</a>
    `;

    const result = parseYearListPage(html, 2024);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe(
      "令和６年第７回那珂川町議会定例会（１２月）会議録"
    );
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseYearListPage("", 2024)).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  it("テーブルから PDF リンクと開催日を抽出する", () => {
    const html = `
      <table>
        <tr>
          <th>月日</th>
          <th>曜日</th>
          <th>時間</th>
          <th>議事・議案</th>
        </tr>
        <tr>
          <td><a href="files/R6.12.3.pdf">12月3日</a></td>
          <td>火</td>
          <td>午前10時</td>
          <td>開会、一般質問</td>
        </tr>
        <tr>
          <td><a href="files/R6.12.4.pdf">12月4日</a></td>
          <td>水</td>
          <td>午前10時</td>
          <td>一般質問続き</td>
        </tr>
      </table>
    `;

    const result = parseDetailPage(html, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/files/R6.12.3.pdf"
    );
    expect(result[0]!.heldOn).toBe("2024-12-03");
    expect(result[0]!.pdfKey).toBe("094111_R6.12.3.pdf");
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/files/R6.12.4.pdf"
    );
    expect(result[1]!.heldOn).toBe("2024-12-04");
  });

  it("絶対 URL 形式の PDF リンクも処理する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/files/R6.12.3.pdf">12月3日</a></td>
          <td>火</td>
          <td>午前10時</td>
          <td>開会</td>
        </tr>
      </table>
    `;

    const result = parseDetailPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/files/R6.12.3.pdf"
    );
  });

  it("月日が和暦で記載されている場合も処理する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="files/teireikai1t1.pdf">令和6年3月4日</a></td>
          <td>月</td>
          <td>午前10時</td>
          <td>開会</td>
        </tr>
      </table>
    `;

    const result = parseDetailPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-03-04");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <table>
        <tr>
          <td><a href="files/R6.12.3.pdf">12月3日</a></td>
          <td>火</td><td>午前10時</td><td>開会</td>
        </tr>
        <tr>
          <td><a href="files/R6.12.3.pdf">12月3日</a></td>
          <td>火</td><td>午前10時</td><td>（再掲）</td>
        </tr>
      </table>
    `;

    const result = parseDetailPage(html, 2024);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <td>12月5日</td>
          <td>木</td>
          <td>休会</td>
          <td>-</td>
        </tr>
      </table>
    `;

    const result = parseDetailPage(html, 2024);
    expect(result).toHaveLength(0);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseDetailPage("", 2024)).toEqual([]);
  });

  it("月が1桁の場合も正しくパースする", () => {
    const html = `
      <table>
        <tr>
          <td><a href="files/R6.6.4.pdf">6月4日</a></td>
          <td>火</td>
          <td>午前10時</td>
          <td>開会</td>
        </tr>
      </table>
    `;

    const result = parseDetailPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-06-04");
  });
});
