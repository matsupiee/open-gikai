import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("指定年の会議録 PDF リンクを抽出する", () => {
    const html = `
      <h4>令和7年(2025年)</h4>
      <table>
        <tr>
          <td><strong>第4回定例会(12月3日から15日)</strong></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/aaaa.pdf">付議案件</a></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/bbbb.pdf">会期日程</a></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/cccc.pdf">3月3日会議録</a>
              <a href="/index.cfm/15,12059,c,html/12059/dddd.pdf">12月15日会議録</a></td>
        </tr>
        <tr>
          <td><strong>第3回定例会(9月2日から14日)</strong></td>
          <td></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/eeee.pdf">9月3日会議録</a></td>
        </tr>
      </table>
      <h4>令和6年(2024年)</h4>
      <table>
        <tr>
          <td><strong>第4回定例会(12月2日から13日)</strong></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/ffff.pdf">12月10日会議録</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(3);

    // 最初のリンク: 3月3日会議録
    expect(meetings[0]!.heldOn).toBe("2025-03-03");
    expect(meetings[0]!.title).toBe("第4回定例会(12月3日から15日) 3月3日会議録");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.miyagi-matsushima.lg.jp/index.cfm/15,12059,c,html/12059/cccc.pdf"
    );

    // 2番目のリンク: 12月15日会議録
    expect(meetings[1]!.heldOn).toBe("2025-12-15");
    expect(meetings[1]!.title).toBe("第4回定例会(12月3日から15日) 12月15日会議録");

    // 3番目のリンク: 9月3日会議録
    expect(meetings[2]!.heldOn).toBe("2025-09-03");
    expect(meetings[2]!.title).toBe("第3回定例会(9月2日から14日) 9月3日会議録");
  });

  it("会議録テキストを含まないリンク（付議案件等）はスキップする", () => {
    const html = `
      <h4>令和7年(2025年)</h4>
      <table>
        <tr>
          <td><strong>第1回定例会(3月3日から17日)</strong></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/aaaa.pdf">付議案件</a></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/bbbb.pdf">会期日程</a></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/cccc.pdf">一般質問</a></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/dddd.pdf">3月3日会議録</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toContain("会議録");
  });

  it("対象年と異なるブロックはスキップする", () => {
    const html = `
      <h4>令和8年(2026年)</h4>
      <table>
        <tr>
          <td><a href="/index.cfm/15,12059,c,html/12059/aaaa.pdf">3月3日会議録</a></td>
        </tr>
      </table>
      <h4>令和7年(2025年)</h4>
      <table>
        <tr>
          <td><a href="/index.cfm/15,12059,c,html/12059/bbbb.pdf">12月15日会議録</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-15");
  });

  it("臨時会のリンクは meetingType が extraordinary になる", () => {
    const html = `
      <h4>令和7年(2025年)</h4>
      <table>
        <tr>
          <td><strong>第1回臨時会(5月15日)</strong></td>
          <td><a href="/index.cfm/15,12059,c,html/12059/aaaa.pdf">5月15日会議録</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2025-05-15");
  });

  it("対象年が存在しない場合は空配列を返す", () => {
    const html = `
      <h4>令和6年(2024年)</h4>
      <table>
        <tr>
          <td><a href="/index.cfm/15,12059,c,html/12059/aaaa.pdf">12月10日会議録</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });

  it("全角括弧の年度表記も処理できる", () => {
    const html = `
      <h4>令和7年（2025年）</h4>
      <table>
        <tr>
          <td><a href="/index.cfm/15,12059,c,html/12059/aaaa.pdf">3月5日会議録</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-05");
  });
});
