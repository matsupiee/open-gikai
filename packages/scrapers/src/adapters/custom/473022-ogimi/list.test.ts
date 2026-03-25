import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("PDF リンクからメタ情報を抽出する", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2025/01/R7%E3%80%80%E7%AC%AC1%E5%9B%9E%E8%87%A8%E6%99%82%E4%BC%9A.pdf">R7　第1回臨時会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.sessionNumber).toBe(1);
    expect(meetings[0]!.title).toBe("R7　第1回臨時会");
  });

  it("定例会を correct に検出する", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2024/07/R6%E3%80%80%E7%AC%AC3%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">R6　第3回定例会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.sessionNumber).toBe(3);
  });

  it("平成年度を正しくパースする", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2018/07/H30%E7%AC%AC3%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">H30　第3回定例会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2018);
  });

  it("月付きファイル名を正しくパースする", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2025/04/R7.4%E6%9C%88%E3%80%80%E7%AC%AC4%E5%9B%9E%E8%87%A8%E6%99%82%E4%BC%9A%E3%80%80%E4%BC%9A%E8%AD%B0%E9%8C%B2.pdf">R7.4月　第4回臨時会　会議録</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.sessionNumber).toBe(4);
  });

  it("会議録が先頭にくるファイル名を正しくパースする", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2024/02/%E4%BC%9A%E8%AD%B0%E9%8C%B2%E3%80%80R6%E3%80%80%E7%AC%AC7%E5%9B%9E%E8%87%A8%E6%99%82%E4%BC%9A.pdf">会議録　R6　第7回臨時会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.sessionNumber).toBe(7);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("リンクテキストが空の場合はファイル名からタイトルを生成する", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2024/07/R6%E7%AC%AC3%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf"></a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("R6第3回定例会");
    expect(meetings[0]!.year).toBe(2024);
  });

  it("PDF 以外のリンクを無視する", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/page.html">会議録ページ</a>
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2024/07/R6%E7%AC%AC3%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">R6　第3回定例会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("R6　第3回定例会");
  });

  it("複数年度の PDF を全て取得する", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2025/01/R7%E7%AC%AC1%E5%9B%9E.pdf">R7　第1回臨時会</a>
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2024/07/R6%E7%AC%AC3%E5%9B%9E.pdf">R6　第3回定例会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[1]!.year).toBe(2024);
  });

  it("リンクが一件もない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("年度が解析できないリンクも含まれる", () => {
    const html = `
      <a href="http://ogimi-gikai.sakura.ne.jp/site/wp-content/uploads/2024/07/unknown.pdf">不明な会議録</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBeNull();
  });
});
