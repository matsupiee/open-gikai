import { describe, expect, it } from "vitest";
import { parsePdfLinks } from "./list";

describe("parsePdfLinks", () => {
  it("令和7年の定例会リンクを解析する", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/7.3.pdf">第３回定例会（６月）</a></li>
        <li><a href="/www/contents/1000000000443/simple/7.1.pdf">第１回定例会（３月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.month).toBe(6);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.tsumagoi.gunma.jp/www/contents/1000000000443/simple/7.3.pdf"
    );
    expect(result[1]!.year).toBe(2025);
    expect(result[1]!.month).toBe(3);
    expect(result[1]!.meetingType).toBe("plenary");
  });

  it("臨時会を正しく解析する", () => {
    const html = `
      <h3>令和5年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/5.5r.pdf">第２回臨時会（５月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2023);
    expect(result[0]!.month).toBe(5);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("複数年度が混在する場合にそれぞれの年度を正しく解析する", () => {
    const html = `
      <h3>令和6年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/6.3.pdf">第１回定例会（３月）</a></li>
      </ul>
      <h3>令和5年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/5.3t.pdf">第１回定例会（３月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.month).toBe(3);
    expect(result[1]!.year).toBe(2023);
    expect(result[1]!.month).toBe(3);
  });

  it("平成年号を正しく変換する", () => {
    const html = `
      <h3>平成28年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/28.6.pdf">第４回定例会（６月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2016);
    expect(result[0]!.month).toBe(6);
  });

  it("月情報がないリンクはスキップする", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/other.pdf">その他の文書</a></li>
        <li><a href="/www/contents/1000000000443/simple/7.3.pdf">第３回定例会（６月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.month).toBe(6);
  });

  it("全角数字を正しく処理する", () => {
    const html = `
      <h3>令和４年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/R4.1.pdf">第１回臨時会（２月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2022);
    expect(result[0]!.month).toBe(2);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });

  it("title に年度情報が含まれる", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="/www/contents/1000000000443/simple/7.3.pdf">第３回定例会（６月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result[0]!.title).toContain("2025年");
    expect(result[0]!.title).toContain("定例会");
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <h3>令和7年</h3>
      <ul>
        <li><a href="https://www.vill.tsumagoi.gunma.jp/www/contents/1000000000443/simple/7.3.pdf">第３回定例会（６月）</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html);

    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.tsumagoi.gunma.jp/www/contents/1000000000443/simple/7.3.pdf"
    );
  });
});
