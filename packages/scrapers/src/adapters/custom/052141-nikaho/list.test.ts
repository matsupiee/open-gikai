import { describe, expect, it } from "vitest";
import { parseConferencePage } from "./list";

describe("parseConferencePage", () => {
  it("新形式 PDF リンク（令和6年）を正しく抽出する", () => {
    const html = `
      <div id="tab20">
        <table>
          <thead><tr><th>会議</th><th>1日目</th><th>2日目</th></tr></thead>
          <tbody>
            <tr>
              <th>令和6年 第8回定例会</th>
              <td><a href="/pdf/36/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC8%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A1%E6%97%A5%E7%9B%AE%EF%BC%8811%E6%9C%8826%E6%97%A5%EF%BC%89.pdf"><img src="/img/pdf_32.png"></a></td>
              <td><a href="/pdf/36/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC8%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A2%E6%97%A5%E7%9B%AE%EF%BC%8812%E6%9C%882%E6%97%A5%EF%BC%89.pdf"><img src="/img/pdf_32.png"></a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const meetings = parseConferencePage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.nikahoshigikai.akita.jp/pdf/36/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC8%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A1%E6%97%A5%E7%9B%AE%EF%BC%8811%E6%9C%8826%E6%97%A5%EF%BC%89.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-11-26");
    expect(meetings[0]!.title).toBe("第8回定例会 1日目");
    expect(meetings[1]!.heldOn).toBe("2024-12-02");
    expect(meetings[1]!.title).toBe("第8回定例会 2日目");
  });

  it("臨時会の PDF リンクを正しく抽出する", () => {
    const html = `
      <div id="tab19">
        <table>
          <thead><tr><th>会議</th><th>1日目</th></tr></thead>
          <tbody>
            <tr>
              <th>令和5年 第3回臨時会</th>
              <td><a href="/pdf/35/%E4%BB%A4%E5%92%8C5%E5%B9%B4%E7%AC%AC3%E5%9B%9E%E8%87%A8%E6%99%82%E4%BC%9A%EF%BC%881%E6%9C%8813%E6%97%A5%EF%BC%89.pdf"><img></a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const meetings = parseConferencePage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-01-13");
    expect(meetings[0]!.title).toBe("第3回臨時会");
  });

  it("日付情報がないファイル名（副本など）はスキップする", () => {
    const html = `
      <div id="tab19">
        <table>
          <thead><tr><th>会議</th><th>3日目</th></tr></thead>
          <tbody>
            <tr>
              <th>令和5年 第8回定例会</th>
              <td><a href="/pdf/35/%E4%BB%A4%E5%92%8C5%E5%B9%B4%E7%AC%AC8%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A3%E6%97%A5%E7%9B%AE%E3%80%90%E5%89%AF%E6%9C%AC%E3%80%91.pdf"><img></a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const meetings = parseConferencePage(html);

    // 副本は日付がないのでスキップされる
    expect(meetings).toHaveLength(0);
  });

  it("令和7年（r07）の PDF リンクを正しく抽出する", () => {
    const html = `
      <div id="tab21">
        <table>
          <thead><tr><th>会議</th><th>1日目</th></tr></thead>
          <tbody>
            <tr>
              <th>令和7年 第5回定例会</th>
              <td><a href="/pdf/r07/%E4%BB%A4%E5%92%8C7%E5%B9%B4%E7%AC%AC5%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A1%E6%97%A5%E7%9B%AE%EF%BC%889%E6%9C%882%E6%97%A5%EF%BC%89.pdf"><img></a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const meetings = parseConferencePage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-09-02");
    expect(meetings[0]!.title).toBe("第5回定例会 1日目");
  });

  it("(訂正版) 付きファイル名も正しく解析する", () => {
    // (訂正版)令和4年第5回定例会1日目（8月31日）.pdf をエンコード
    const encoded =
      "%28%E8%A8%82%E6%AD%A3%E7%89%88%29%E4%BB%A4%E5%92%8C4%E5%B9%B4%E7%AC%AC5%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A1%E6%97%A5%E7%9B%AE%EF%BC%888%E6%9C%8831%E6%97%A5%EF%BC%89.pdf";
    const html = `
      <div id="tab18">
        <table>
          <thead><tr><th>会議</th><th>1日目</th></tr></thead>
          <tbody>
            <tr>
              <th>令和4年 第5回定例会</th>
              <td><a href="/pdf/34/${encoded}"><img></a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const meetings = parseConferencePage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2022-08-31");
    expect(meetings[0]!.title).toBe("第5回定例会 1日目");
  });

  it("同一 URL の重複は除去する", () => {
    const href =
      "/pdf/36/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC8%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A1%E6%97%A5%E7%9B%AE%EF%BC%8811%E6%9C%8826%E6%97%A5%EF%BC%89.pdf";
    const html = `
      <div id="tab20">
        <table>
          <thead><tr><th>会議</th><th>1日目</th></tr></thead>
          <tbody>
            <tr>
              <th>令和6年 第8回定例会</th>
              <td><a href="${href}"><img></a></td>
            </tr>
            <tr>
              <th>（重複）</th>
              <td><a href="${href}"><img></a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const meetings = parseConferencePage(html);

    expect(meetings).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div id="tab20"><table><tbody><tr><th>令和6年</th><td>-</td></tr></tbody></table></div>`;

    const meetings = parseConferencePage(html);

    expect(meetings).toHaveLength(0);
  });
});
