import { describe, expect, it } from "vitest";
import { parseFiscalYear, parseIssueNumber, parseListPage } from "./list";

describe("parseIssueNumber", () => {
  it("号数を抽出する", () => {
    expect(parseIssueNumber("第181号(6MB)")).toBe(181);
  });

  it("号数がない場合は null を返す", () => {
    expect(parseIssueNumber("PDF(6MB)")).toBeNull();
  });
});

describe("parseFiscalYear", () => {
  it("令和年度を西暦に変換する", () => {
    expect(parseFiscalYear("令和７年度")).toBe(2025);
  });

  it("平成31(令和元)年度を令和元年度として扱う", () => {
    expect(parseFiscalYear("平成31(令和元)年度")).toBe(2019);
  });
});

describe("parseListPage", () => {
  it("一覧テーブルから PDF と年度情報を抽出する", () => {
    const html = `
      <h2>令和７年度</h2>
      <table>
        <thead>
          <tr><th>4月</th><th>7月</th><th>10月</th><th>1月</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="./files/gikai_181.pdf">第181号(6MB)</a></td>
            <td><a href="./files/gikai_182.pdf">第182号(5MB)</a></td>
            <td><a href="./files/gikai_183.pdf">第183号(5MB)</a></td>
            <td><a href="./files/gikai_184.pdf">第184号(5MB)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.wakayama-hidaka.lg.jp/docs/2014090500409/files/gikai_181.pdf",
    );
    expect(meetings[0]!.title).toBe("日高町議会だより 第181号");
    expect(meetings[0]!.meetingYear).toBe(2025);
    expect(meetings[0]!.publishYear).toBe(2025);
    expect(meetings[0]!.publishMonth).toBe(4);

    expect(meetings[3]!.meetingYear).toBe(2025);
    expect(meetings[3]!.publishYear).toBe(2026);
    expect(meetings[3]!.publishMonth).toBe(1);
  });

  it("PDF がないセルはスキップする", () => {
    const html = `
      <h2>令和６年度</h2>
      <table>
        <thead>
          <tr><th>4月</th><th>7月</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>&nbsp;</td>
            <td><a href="./files/gikai_178.pdf">第178号(4MB)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.issueNumber).toBe(178);
    expect(meetings[0]!.meetingYear).toBe(2024);
  });
});
