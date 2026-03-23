import { describe, expect, it } from "vitest";
import { parseListPage, hasNextPage } from "./list";

describe("parseListPage", () => {
  it("本会議一覧ページからPDFリンクとメタ情報を抽出する", () => {
    const html = `
      <html>
      <body>
      <table>
        <tr>
          <td>令和7年第1回定例会</td>
          <td>R07/3/11～14</td>
          <td><a href="/contents/20down/gikai-ka/2025/r07_1all.pdf">会議録</a></td>
        </tr>
        <tr>
          <td>令和6年第4回定例会</td>
          <td>R06/12/5</td>
          <td><a href="/contents/20down/gikai-ka/2024/r06_4all.pdf">会議録</a></td>
        </tr>
      </table>
      </body>
      </html>
    `;

    const documents = parseListPage(html, 152);

    expect(documents).toHaveLength(2);
    expect(documents[0]!.pdfUrl).toBe(
      "https://www.town.kamifurano.hokkaido.jp/contents/20down/gikai-ka/2025/r07_1all.pdf",
    );
    expect(documents[0]!.meetingType).toBe("plenary");
    expect(documents[0]!.rawDate).toBe("R07/3/11");
    expect(documents[1]!.pdfUrl).toBe(
      "https://www.town.kamifurano.hokkaido.jp/contents/20down/gikai-ka/2024/r06_4all.pdf",
    );
    expect(documents[1]!.rawDate).toBe("R06/12/5");
  });

  it("予算特別委員会一覧ページからPDFリンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年予算特別委員会</td>
          <td>R07/3/14</td>
          <td><a href="/contents/20down/gikai-ka/yo_toku/r07_yosan_all.pdf">会議録</a></td>
        </tr>
      </table>
    `;

    const documents = parseListPage(html, 153);

    expect(documents).toHaveLength(1);
    expect(documents[0]!.pdfUrl).toBe(
      "https://www.town.kamifurano.hokkaido.jp/contents/20down/gikai-ka/yo_toku/r07_yosan_all.pdf",
    );
    expect(documents[0]!.meetingType).toBe("committee");
  });

  it("決算特別委員会一覧ページからPDFリンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>令和6年決算特別委員会</td>
          <td>R06/9/10</td>
          <td><a href="/contents/20down/gikai-ka/ke_toku/r06_kessan_all.pdf">会議録</a></td>
        </tr>
      </table>
    `;

    const documents = parseListPage(html, 154);

    expect(documents).toHaveLength(1);
    expect(documents[0]!.meetingType).toBe("committee");
  });

  it("PDFリンクがないテーブル行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <th>会議名</th>
          <th>開催日</th>
          <th>会議録</th>
        </tr>
        <tr>
          <td>令和7年第1回定例会</td>
          <td>R07/3/11</td>
          <td>準備中</td>
        </tr>
      </table>
    `;

    const documents = parseListPage(html, 152);
    expect(documents).toHaveLength(0);
  });

  it("同じPDFリンクの重複を除外する", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年第1回定例会</td>
          <td>R07/3/11</td>
          <td><a href="/contents/20down/gikai-ka/2025/r07_1all.pdf">会議録</a></td>
        </tr>
        <tr>
          <td>令和7年第1回定例会</td>
          <td>R07/3/11</td>
          <td><a href="/contents/20down/gikai-ka/2025/r07_1all.pdf">会議録</a></td>
        </tr>
      </table>
    `;

    const documents = parseListPage(html, 152);
    expect(documents).toHaveLength(1);
  });

  it("日付がない場合は rawDate が null になる", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年第1回定例会</td>
          <td><a href="/contents/20down/gikai-ka/2025/r07_1all.pdf">会議録</a></td>
        </tr>
      </table>
    `;

    const documents = parseListPage(html, 152);
    expect(documents).toHaveLength(1);
    expect(documents[0]!.rawDate).toBeNull();
  });

  it("絶対URLのPDFリンクもそのまま使う", () => {
    const html = `
      <table>
        <tr>
          <td>会議録</td>
          <td>R07/3/11</td>
          <td><a href="https://www.town.kamifurano.hokkaido.jp/contents/20down/gikai-ka/2025/r07_1all.pdf">PDF</a></td>
        </tr>
      </table>
    `;

    const documents = parseListPage(html, 152);
    expect(documents).toHaveLength(1);
    expect(documents[0]!.pdfUrl).toBe(
      "https://www.town.kamifurano.hokkaido.jp/contents/20down/gikai-ka/2025/r07_1all.pdf",
    );
  });
});

describe("hasNextPage", () => {
  it("次ページリンクがある場合は true を返す", () => {
    const html = `<a href="?id=152&dpgndg1=2">2</a>`;
    expect(hasNextPage(html, 1)).toBe(true);
  });

  it("次ページリンクがない場合は false を返す", () => {
    const html = `<a href="?id=152&dpgndg1=1">1</a>`;
    expect(hasNextPage(html, 1)).toBe(false);
  });

  it("最終ページで次ページリンクがない場合は false を返す", () => {
    const html = `<p>ページ 3/3</p><a href="?id=152&dpgndg1=2">2</a>`;
    expect(hasNextPage(html, 3)).toBe(false);
  });
});
