import { describe, expect, it } from "vitest";
import { parseLinkText, parseListPage } from "./list";

describe("parseLinkText", () => {
  it("西暦年プレフィックス + (月号) パターンを処理する", () => {
    const result = parseLinkText("2024諸塚村議会だより(11月号)No.183号");
    expect(result.issueNumber).toBe(183);
    expect(result.year).toBe(2024);
    expect(result.month).toBe(11);
  });

  it("全角括弧 + 西暦年プレフィックスパターンを処理する", () => {
    const result = parseLinkText("2024諸塚村議会だより（8月号）No.182");
    expect(result.issueNumber).toBe(182);
    expect(result.year).toBe(2024);
    expect(result.month).toBe(8);
  });

  it("2021年1月号パターンを処理する", () => {
    const result = parseLinkText("2021諸塚村議会だより（1月号）No.168号");
    expect(result.issueNumber).toBe(168);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(1);
  });

  it("令和年月パターンを処理する", () => {
    const result = parseLinkText("議会だよりNo.170（令和元年8月号）");
    expect(result.issueNumber).toBe(170);
    expect(result.year).toBe(2019);
    expect(result.month).toBe(8);
  });

  it("平成年月パターンを処理する", () => {
    const result = parseLinkText("議会だよりNo.153（平成29年5月号）");
    expect(result.issueNumber).toBe(153);
    expect(result.year).toBe(2017);
    expect(result.month).toBe(5);
  });

  it("年月が含まれないテキストは null を返す", () => {
    const result = parseLinkText("議会構成");
    expect(result.year).toBeNull();
    expect(result.month).toBeNull();
  });

  it("No.なしのテキストでも年月を抽出する", () => {
    const result = parseLinkText("2024諸塚村議会だより（8月号）");
    expect(result.issueNumber).toBeNull();
    expect(result.year).toBe(2024);
    expect(result.month).toBe(8);
  });
});

describe("parseListPage", () => {
  it("material/files/group/9/ の PDF リンクを抽出する（実際の形式）", () => {
    const html = `
      <html><body>
        <ul>
          <li>
            <a href="//www.vill.morotsuka.miyazaki.jp/material/files/group/9/6f52f1e95d229e45658fb9405a5dfe57.pdf">2024諸塚村議会だより(11月号)No.183号 (PDFファイル: 4.8MB)</a>
          </li>
          <li>
            <a href="//www.vill.morotsuka.miyazaki.jp/material/files/group/9/37f914ab00d5a43c806734184ee2bb56.pdf">2024諸塚村議会だより(8月号)No.182 (PDFファイル: 1.8MB)</a>
          </li>
          <li>
            <a href="//www.vill.morotsuka.miyazaki.jp/material/files/group/9/5fc1c71b259f622233d6dc415685ced8.pdf">2024諸塚村議会だより(1月号)No.180 (PDFファイル: 3.5MB)</a>
          </li>
        </ul>
      </body></html>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.morotsuka.miyazaki.jp/material/files/group/9/6f52f1e95d229e45658fb9405a5dfe57.pdf",
    );
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.month).toBe(11);

    expect(meetings[1]!.year).toBe(2024);
    expect(meetings[1]!.month).toBe(8);

    expect(meetings[2]!.year).toBe(2024);
    expect(meetings[2]!.month).toBe(1);
  });

  it("プロトコル相対 URL を https に変換する", () => {
    const html = `
      <a href="//www.vill.morotsuka.miyazaki.jp/material/files/group/9/test.pdf">2025諸塚村議会だより（1月号）No.184</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.morotsuka.miyazaki.jp/material/files/group/9/test.pdf",
    );
  });

  it("絶対 URL はそのまま保持する", () => {
    const html = `
      <a href="https://www.vill.morotsuka.miyazaki.jp/material/files/group/9/doc.pdf">2025諸塚村議会だより（5月号）No.185</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.morotsuka.miyazaki.jp/material/files/group/9/doc.pdf",
    );
  });

  it("material/files/group/9/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <a href="/other/path/doc.pdf">2024諸塚村議会だより（8月号）No.182</a>
      <a href="/material/files/group/9/valid.pdf">2024諸塚村議会だより（11月号）No.183</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.month).toBe(11);
  });

  it("年月が解析できないリンクはスキップする", () => {
    const html = `
      <a href="/material/files/group/9/other.pdf">議会構成メンバー</a>
      <a href="/material/files/group/9/valid.pdf">2024諸塚村議会だより（11月号）No.183</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.month).toBe(11);
  });

  it("重複 URL は除去する", () => {
    const html = `
      <a href="/material/files/group/9/dup.pdf">2024諸塚村議会だより（11月号）No.183</a>
      <a href="/material/files/group/9/dup.pdf">2024諸塚村議会だより（11月号）No.183</a>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});
