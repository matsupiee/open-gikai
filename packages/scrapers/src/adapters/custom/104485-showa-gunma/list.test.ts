import { describe, expect, it } from "vitest";
import { parseTopPage, parsePdfLinks } from "./list";

describe("parseTopPage", () => {
  it("h5/h6 構造から年度・会議名・URL を抽出する", () => {
    const html = `
      <h5>令和7年</h5>
      <h6><a href="/kurashi/gyousei/assembly/2025_12_teireikai.html">第4回定例会</a></h6>
      <h6><a href="/kurashi/gyousei/assembly/2026-0123-1020-18.html">第3回定例会</a></h6>
      <h5>令和6年</h5>
      <h6><a href="/kurashi/gyousei/assembly/2024-0408-1550-18.html">第1回臨時会</a></h6>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.sessionTitle).toBe("第4回定例会");
    expect(result[0]!.url).toBe(
      "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/2025_12_teireikai.html"
    );
    expect(result[1]!.year).toBe(2025);
    expect(result[1]!.sessionTitle).toBe("第3回定例会");
    expect(result[2]!.year).toBe(2024);
    expect(result[2]!.sessionTitle).toBe("第1回臨時会");
  });

  it("年度表記がない h5 はスキップする", () => {
    const html = `
      <h5>お知らせ</h5>
      <h6><a href="/assembly/notice.html">お知らせ</a></h6>
      <h5>令和7年</h5>
      <h6><a href="/kurashi/gyousei/assembly/2025_12_teireikai.html">第4回定例会</a></h6>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <h5>令和7年</h5>
      <h6><a href="https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/2025_12_teireikai.html">第4回定例会</a></h6>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/2025_12_teireikai.html"
    );
  });

  it("会議リンクがない場合は空配列を返す", () => {
    const html = "<h5>令和7年</h5><p>準備中</p>";
    const result = parseTopPage(html);
    expect(result).toHaveLength(0);
  });
});

describe("parsePdfLinks", () => {
  it("本文 PDF リンクを抽出する（新形式: honbun を含む）", () => {
    const html = `
      <ul>
        <li><a href="/files/01/20251203_meibo.pdf">第1号 名簿</a></li>
        <li><a href="/files/01/20251203_honbun.pdf">第1号 本文</a></li>
        <li><a href="/files/01/20251204_meibo.pdf">第2号 名簿</a></li>
        <li><a href="/files/01/20251204_honbun.pdf">第2号 本文</a></li>
      </ul>
    `;
    const baseUrl = "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/2025_12_teireikai.html";

    const result = parsePdfLinks(html, baseUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.showa.gunma.jp/files/01/20251203_honbun.pdf"
    );
    expect(result[0]!.goNumber).toBe("第1号");
    expect(result[1]!.pdfUrl).toBe(
      "https://www.vill.showa.gunma.jp/files/01/20251204_honbun.pdf"
    );
    expect(result[1]!.goNumber).toBe("第2号");
  });

  it("リンクテキストに「本文」を含む PDF を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/files/01/6-3-1-1.pdf">第1号 名簿</a></li>
        <li><a href="/files/01/6-3-1-2.pdf">第1号 本文</a></li>
      </ul>
    `;
    const baseUrl = "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/session.html";

    const result = parsePdfLinks(html, baseUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("6-3-1-2.pdf");
  });

  it("名簿 PDF（meibo を含む）はスキップする", () => {
    const html = `
      <ul>
        <li><a href="/files/01/20251203_meibo.pdf">第1号 名簿</a></li>
      </ul>
    `;
    const baseUrl = "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/session.html";

    const result = parsePdfLinks(html, baseUrl);

    expect(result).toHaveLength(0);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>準備中</p>";
    const baseUrl = "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/session.html";
    expect(parsePdfLinks(html, baseUrl)).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクを正しく処理する", () => {
    const html = `
      <a href="https://www.vill.showa.gunma.jp/files/01/20251203_honbun.pdf">第1号 本文</a>
    `;
    const baseUrl = "https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/session.html";

    const result = parsePdfLinks(html, baseUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.showa.gunma.jp/files/01/20251203_honbun.pdf"
    );
  });
});
