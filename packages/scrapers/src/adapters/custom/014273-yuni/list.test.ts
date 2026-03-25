import { describe, expect, it } from "vitest";
import {
  parseListPage,
  extractYearFromUrl,
  extractYearFromFilename,
} from "./list";

describe("parseListPage", () => {
  it("会議録 PDF リンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <p>
          <a href="/wp-content/uploads/2025/03/R07_1定_01.pdf">R07_1定_01.pdf</a>
          <a href="/wp-content/uploads/2025/03/R07_1定_02.pdf">R07_1定_02.pdf</a>
        </p>
      </div>
    `;

    const links = parseListPage(html, "teireikai");

    expect(links).toHaveLength(2);
    expect(links[0]!.pdfUrl).toBe(
      "https://www.town.yuni.lg.jp/wp-content/uploads/2025/03/R07_1定_01.pdf",
    );
    expect(links[0]!.linkText).toBe("R07_1定_01.pdf");
    expect(links[0]!.meetingType).toBe("plenary");
    expect(links[0]!.pageType).toBe("teireikai");

    expect(links[1]!.pdfUrl).toBe(
      "https://www.town.yuni.lg.jp/wp-content/uploads/2025/03/R07_1定_02.pdf",
    );
  });

  it("「議決結果」を含むリンクを除外する", () => {
    const html = `
      <a href="/wp-content/uploads/2025/03/R07_1定_01.pdf">R07_1定_01.pdf</a>
      <a href="/wp-content/uploads/2025/03/giketsukekka.pdf">議決結果</a>
    `;

    const links = parseListPage(html, "teireikai");
    expect(links).toHaveLength(1);
    expect(links[0]!.linkText).toBe("R07_1定_01.pdf");
  });

  it("wp-content/uploads を含まないリンクを除外する", () => {
    const html = `
      <a href="/chosei/gikai/teireikai">定例会のページ</a>
      <a href="/wp-content/uploads/2025/03/R07_1定_01.pdf">R07_1定_01.pdf</a>
    `;

    const links = parseListPage(html, "teireikai");
    expect(links).toHaveLength(1);
    expect(links[0]!.linkText).toBe("R07_1定_01.pdf");
  });

  it(".pdf で終わらないリンクを除外する", () => {
    const html = `
      <a href="/wp-content/uploads/2025/03/image.png">画像</a>
      <a href="/wp-content/uploads/2025/03/R07_1定_01.pdf">会議録</a>
    `;

    const links = parseListPage(html, "teireikai");
    expect(links).toHaveLength(1);
  });

  it("臨時会ページのリンクは extraordinary に分類される", () => {
    const html = `
      <a href="/wp-content/uploads/2025/01/R07_1臨_01.pdf">R07_1臨_01.pdf</a>
    `;

    const links = parseListPage(html, "rinjikai");
    expect(links).toHaveLength(1);
    expect(links[0]!.meetingType).toBe("extraordinary");
    expect(links[0]!.pageType).toBe("rinjikai");
  });

  it("リンクが存在しない場合は空配列を返す", () => {
    const html = `<div class="entry-content"><p>会議録はありません。</p></div>`;
    const links = parseListPage(html, "teireikai");
    expect(links).toHaveLength(0);
  });

  it("絶対 URL のリンクはそのまま使用する", () => {
    const html = `
      <a href="https://www.town.yuni.lg.jp/wp-content/uploads/2025/03/R07_1定_01.pdf">会議録</a>
    `;
    const links = parseListPage(html, "teireikai");
    expect(links).toHaveLength(1);
    expect(links[0]!.pdfUrl).toBe(
      "https://www.town.yuni.lg.jp/wp-content/uploads/2025/03/R07_1定_01.pdf",
    );
  });
});

describe("extractYearFromUrl", () => {
  it("URL から西暦年を抽出する", () => {
    expect(
      extractYearFromUrl(
        "https://www.town.yuni.lg.jp/wp-content/uploads/2025/03/R07_1定_01.pdf",
      ),
    ).toBe(2025);
  });

  it("URL から 2024 年を抽出する", () => {
    expect(
      extractYearFromUrl(
        "https://www.town.yuni.lg.jp/wp-content/uploads/2024/06/R06_2定_01.pdf",
      ),
    ).toBe(2024);
  });

  it("wp-content/uploads パターンがない場合は null を返す", () => {
    expect(extractYearFromUrl("https://example.com/other.pdf")).toBeNull();
  });
});

describe("extractYearFromFilename", () => {
  it("R07 → 2025", () => {
    expect(extractYearFromFilename("R07_1定_01.pdf")).toBe(2025);
  });

  it("R06 → 2024", () => {
    expect(extractYearFromFilename("R06_3定_01.pdf")).toBe(2024);
  });

  it("R04 → 2022", () => {
    expect(extractYearFromFilename("R04_1teireikai01.pdf")).toBe(2022);
  });

  it("全角数字を含む場合も正規化する", () => {
    expect(extractYearFromFilename("R07_１臨_01.pdf")).toBe(2025);
  });

  it("パターンに一致しない場合は null を返す", () => {
    expect(extractYearFromFilename("20221206-kaigiroku_1.pdf")).toBeNull();
  });
});
