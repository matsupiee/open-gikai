import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("ul>li>a 構造から PDF リンクを抽出する", () => {
    const html = `
      <p>町議会定例会における一般質問と答弁の内容をお知らせします</p>
      <ul>
        <li><a href="/sites/default/files/user-data/gikai/pdf/%E4%BB%A4%E5%92%8C%EF%BC%95%E5%B9%B4%E7%AC%AC%EF%BC%91%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和5年第1回定例会.pdf</a></li>
        <li><a href="/sites/default/files/user-data/gikai/pdf/%E4%BB%A4%E5%92%8C%EF%BC%95%E5%B9%B4%E7%AC%AC%EF%BC%92%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和5年第2回定例会.pdf</a></li>
      </ul>
    `;

    const documents = parseListPage(html);

    expect(documents).toHaveLength(2);
    expect(documents[0]!.pdfUrl).toBe(
      "https://www.town.tohma.hokkaido.jp/sites/default/files/user-data/gikai/pdf/%E4%BB%A4%E5%92%8C%EF%BC%95%E5%B9%B4%E7%AC%AC%EF%BC%91%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf",
    );
    expect(documents[0]!.linkText).toBe("令和5年第1回定例会.pdf");
    expect(documents[1]!.pdfUrl).toBe(
      "https://www.town.tohma.hokkaido.jp/sites/default/files/user-data/gikai/pdf/%E4%BB%A4%E5%92%8C%EF%BC%95%E5%B9%B4%E7%AC%AC%EF%BC%92%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf",
    );
    expect(documents[1]!.linkText).toBe("令和5年第2回定例会.pdf");
  });

  it("絶対 URL の PDF リンクはそのまま使う", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.tohma.hokkaido.jp/sites/default/files/user-data/gikai/pdf/test.pdf">令和7年第1回定例会.pdf</a></li>
      </ul>
    `;

    const documents = parseListPage(html);

    expect(documents).toHaveLength(1);
    expect(documents[0]!.pdfUrl).toBe(
      "https://www.town.tohma.hokkaido.jp/sites/default/files/user-data/gikai/pdf/test.pdf",
    );
  });

  it("同じ PDF URL の重複を除外する", () => {
    const html = `
      <ul>
        <li><a href="/sites/default/files/user-data/gikai/pdf/test.pdf">令和5年第1回定例会.pdf</a></li>
        <li><a href="/sites/default/files/user-data/gikai/pdf/test.pdf">令和5年第1回定例会.pdf</a></li>
      </ul>
    `;

    const documents = parseListPage(html);

    expect(documents).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <p>現在、会議録はございません。</p>
    `;

    const documents = parseListPage(html);

    expect(documents).toHaveLength(0);
  });

  it("複数の PDF リンクを全て抽出する", () => {
    const html = `
      <ul>
        <li><a href="/pdf/r5_1.pdf">令和5年第1回定例会.pdf</a></li>
        <li><a href="/pdf/r5_2.pdf">令和5年第2回定例会.pdf</a></li>
        <li><a href="/pdf/r5_3.pdf">令和5年第3回定例会.pdf</a></li>
        <li><a href="/pdf/r5_4.pdf">令和5年第4回定例会.pdf</a></li>
      </ul>
    `;

    const documents = parseListPage(html);

    expect(documents).toHaveLength(4);
  });
});
