import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("li から PDF と会議開催年月を抽出する", () => {
    const html = `
      <h3>2025年</h3>
      <ul>
        <li>
          <a class="icon-pdf" href="/fs/6/0/9/1/0/8/_/issue78.pdf">No.78 議会だより (PDF 9.79MB)</a>
          2025年9月議会号
        </li>
        <li>
          <a class="icon-pdf" href="/fs/5/8/7/7/5/1/_/issue75.pdf">No.75 議会だより (PDF 7.71MB)</a>
          2024年12月議会号
        </li>
      </ul>
    `;

    const issues = parseListPage(html, 2025);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({
      title: "2025年9月議会号",
      heldOn: "2025-09-01",
      pdfUrl: "https://www.town.higashimiyoshi.lg.jp/fs/6/0/9/1/0/8/_/issue78.pdf",
      articleUrl: "https://www.town.higashimiyoshi.lg.jp/docs/535.html",
      issueNumber: 78,
      year: 2025,
      month: 9,
    });
  });

  it("臨時会付きのタイトルを保持する", () => {
    const html = `
      <h3>2006年</h3>
      <ul>
        <li>
          <a class="icon-pdf" href="/fs/4/8/4/1/9/5/_/gikai01.pdf">No.1 議会だより(PDF 2.83MB)</a>
          第1回臨時会＆2006年6月議会号
        </li>
      </ul>
    `;

    const issues = parseListPage(html, 2006);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.title).toBe("第1回臨時会＆2006年6月議会号");
    expect(issues[0]!.heldOn).toBe("2006-06-01");
    expect(issues[0]!.issueNumber).toBe(1);
  });

  it("会議年月が読めない li はスキップする", () => {
    const html = `
      <h3>2024年</h3>
      <ul>
        <li><a class="icon-pdf" href="/fs/example.pdf">No.74 議会だより</a></li>
      </ul>
    `;

    expect(parseListPage(html, 2024)).toEqual([]);
  });
});
