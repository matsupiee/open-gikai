import { describe, expect, it } from "vitest";
import { parseIndexPage, parseYearPage } from "./list";

describe("parseIndexPage", () => {
  it("年度別ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="/gyoseijoho/gikai/kaigiroku/5392.html">令和8年会議録</a></li>
          <li><a href="/gyoseijoho/gikai/kaigiroku/5135.html">令和7年会議録</a></li>
          <li><a href="/gyoseijoho/gikai/kaigiroku/4883.html">令和6年会議録</a></li>
          <li><a href="/about/">関係ないリンク</a></li>
        </ul>
      </body>
      </html>
    `;

    const urls = parseIndexPage(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5392.html");
    expect(urls[1]).toBe("https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html");
    expect(urls[2]).toBe("https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/4883.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <ul>
        <li><a href="/gyoseijoho/gikai/kaigiroku/5135.html">令和7年会議録</a></li>
        <li><a href="/gyoseijoho/gikai/kaigiroku/5135.html">令和7年会議録</a></li>
      </ul>
    `;

    const urls = parseIndexPage(html);
    expect(urls).toHaveLength(1);
  });

  it("会議録リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const urls = parseIndexPage(html);
    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和7年会議録</h2>
        <h3>令和7年第1回中泊町議会定例会</h3>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/reiwa7nenndai1kainakadomarigikaiteireikai.pdf">
          令和7年第1回中泊町議会定例会会議録 (PDFファイル: 750.9KB)
        </a>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("令和7年第1回中泊町議会定例会");
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.nakadomari.lg.jp/material/files/group/12/reiwa7nenndai1kainakadomarigikaiteireikai.pdf",
    );
    expect(docs[0]!.pageUrl).toBe(pageUrl);
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>令和7年第1回中泊町議会臨時会</h3>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/reiwa7nenndai1kainakadomarimatigikairinnjikai.pdf">
          令和7年第1回中泊町議会臨時会会議録 (PDFファイル: 190.9KB)
        </a>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("令和7年第1回中泊町議会臨時会");
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.nakadomari.lg.jp/material/files/group/12/reiwa7nenndai1kainakadomarimatigikairinnjikai.pdf",
    );
  });

  it("定例会に複数の PDF リンクがある場合をすべて抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>令和7年第1回中泊町議会定例会</h3>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/teireikai1.pdf">
          定例会会議録 (PDFファイル: 750.9KB)
        </a>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/yosan_tokubetsu.pdf">
          予算特別委員会 (PDFファイル: 300.0KB)
        </a>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.title).toBe("令和7年第1回中泊町議会定例会");
    expect(docs[1]!.title).toBe("令和7年第1回中泊町議会定例会");
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.nakadomari.lg.jp/material/files/group/12/teireikai1.pdf",
    );
    expect(docs[1]!.pdfUrl).toBe(
      "https://www.town.nakadomari.lg.jp/material/files/group/12/yosan_tokubetsu.pdf",
    );
  });

  it("複数の会議を順番に抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>令和7年第1回中泊町議会臨時会</h3>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/rinnjikai1.pdf">
          臨時会会議録
        </a>
        <h3>令和7年第1回中泊町議会定例会</h3>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/teireikai1.pdf">
          定例会会議録
        </a>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.title).toBe("令和7年第1回中泊町議会臨時会");
    expect(docs[1]!.title).toBe("令和7年第1回中泊町議会定例会");
  });

  it("定例会・臨時会以外の h3 はスキップする", () => {
    const html = `
      <html>
      <body>
        <h3>関係ない見出し</h3>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/test.pdf">PDF</a>
        <h3>令和7年第1回中泊町議会定例会</h3>
        <a href="//www.town.nakadomari.lg.jp/material/files/group/12/teireikai1.pdf">定例会</a>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("令和7年第1回中泊町議会定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const pageUrl = "https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html";
    const docs = parseYearPage(html, pageUrl);
    expect(docs).toHaveLength(0);
  });

  it("絶対 URL の href もそのまま使用する", () => {
    const html = `
      <html>
      <body>
        <h3>令和7年第1回中泊町議会定例会</h3>
        <a href="https://www.town.nakadomari.lg.jp/material/files/group/12/teireikai1.pdf">
          定例会会議録
        </a>
      </body>
      </html>
    `;
    const pageUrl = "https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/5135.html";

    const docs = parseYearPage(html, pageUrl);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.nakadomari.lg.jp/material/files/group/12/teireikai1.pdf",
    );
  });
});
