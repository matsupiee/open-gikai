import { describe, it, expect } from "vitest";
import { parseYearPage } from "./list";

describe("parseYearPage", () => {
  it("会議録 PDF リンクを正しく抽出する", () => {
    const html = `
      <div class="section">
        <h2>第4回（9月）定例会</h2>
        <ul>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r60901gijiroku.pdf">
            北方町定例会第1号 令和6年9月2日（PDFファイル：60.7KB）
          </a></li>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r60902gijiroku.pdf">
            北方町定例会第2号 令和6年9月10日（PDFファイル：45.3KB）
          </a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.kitagata.gifu.jp/material/files/group/12/r60901gijiroku.pdf");
    expect(meetings[0]!.title).toBe("北方町定例会第1号");
    expect(meetings[0]!.heldOn).toBe("2024-09-02");
    expect(meetings[0]!.sessionTitle).toBe("第4回（9月）定例会");
    expect(meetings[1]!.heldOn).toBe("2024-09-10");
  });

  it("gijiroku を含まない PDF はスキップする（関連資料除外）", () => {
    const html = `
      <div>
        <h2>第4回（9月）定例会</h2>
        <ul>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r60901gijiroku.pdf">
            北方町定例会第1号 令和6年9月2日（PDFファイル：60.7KB）
          </a></li>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r60901_fugi.pdf">
            付議案件 令和6年9月2日（PDFファイル：30.0KB）
          </a></li>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r60901_giketu.pdf">
            議案と議決結果 令和6年9月2日（PDFファイル：20.0KB）
          </a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("r60901gijiroku.pdf");
  });

  it("/material/files/group/12/ を含まない PDF はスキップする", () => {
    const html = `
      <div>
        <h2>定例会</h2>
        <ul>
          <li><a href="/other/path/gijiroku.pdf">令和6年9月2日</a></li>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r60901gijiroku.pdf">
            北方町定例会第1号 令和6年9月2日
          </a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("material/files/group/12");
  });

  it("絶対 URL のリンクも処理する", () => {
    const html = `
      <div>
        <h2>定例会</h2>
        <ul>
          <li><a href="https://www.town.kitagata.gifu.jp/material/files/group/12/r60901gijiroku.pdf">
            北方町定例会第1号 令和6年9月2日
          </a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe("https://www.town.kitagata.gifu.jp/material/files/group/12/r60901gijiroku.pdf");
  });

  it("臨時会も抽出する", () => {
    const html = `
      <div>
        <h2>第1回臨時会</h2>
        <ul>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r40114gijiroku.pdf">
            北方町臨時会 令和4年1月14日（PDFファイル：25.0KB）
          </a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2022-01-14");
    expect(meetings[0]!.sessionTitle).toBe("第1回臨時会");
  });

  it("開催日が解析できないリンクはスキップする", () => {
    const html = `
      <div>
        <h2>定例会</h2>
        <ul>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/gijiroku.pdf">
            会議録はこちら
          </a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("平成の日付も解析できる", () => {
    const html = `
      <div>
        <h2>第3回（9月）定例会</h2>
        <ul>
          <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/h300901gijiroku.pdf">
            北方町定例会第1号 平成30年9月3日（PDFファイル：55.0KB）
          </a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-09-03");
  });

  it("会議録が0件の場合は空配列を返す", () => {
    const html = `<div><p>準備中です</p></div>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });
});
