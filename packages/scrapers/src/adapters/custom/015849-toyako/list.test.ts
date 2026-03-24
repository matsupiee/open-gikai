import { describe, it, expect } from "vitest";
import {
  parseDayFromLinkText,
  extractMeetingTitle,
  extractYearFromTitle,
  parseTable,
  parseYearPage,
} from "./list";

describe("parseDayFromLinkText", () => {
  it("第１日目（９月１０日）から開催日を解析する", () => {
    const result = parseDayFromLinkText("第１日目（９月１０日）", 2025);
    expect(result).toBe("2025-09-10");
  });

  it("第２日目（３月１１日）から開催日を解析する", () => {
    const result = parseDayFromLinkText("第２日目（３月１１日）", 2024);
    expect(result).toBe("2024-03-11");
  });

  it("日付情報がないリンクテキストはnullを返す", () => {
    const result = parseDayFromLinkText("目次等", 2025);
    expect(result).toBeNull();
  });

  it("半角数字の日付も解析できる", () => {
    const result = parseDayFromLinkText("第1日目（9月10日）", 2025);
    expect(result).toBe("2025-09-10");
  });

  it("月と日が1桁の場合はゼロパディングされる", () => {
    const result = parseDayFromLinkText("第１日目（３月５日）", 2022);
    expect(result).toBe("2022-03-05");
  });
});

describe("extractMeetingTitle", () => {
  it("theadから会議名を抽出する", () => {
    const html = `<tr><td colspan="7"><b><i>洞爺湖町議会令和７年９月会議</i></b></td></tr>`;
    const title = extractMeetingTitle(html);
    expect(title).toBe("洞爺湖町議会令和７年９月会議");
  });

  it("HTMLタグを除去する", () => {
    const html = `<td><b>洞爺湖町議会令和６年３月会議</b></td>`;
    const title = extractMeetingTitle(html);
    expect(title).toBe("洞爺湖町議会令和６年３月会議");
  });
});

describe("extractYearFromTitle", () => {
  it("令和7年は2025を返す", () => {
    const year = extractYearFromTitle("洞爺湖町議会令和７年９月会議");
    expect(year).toBe(2025);
  });

  it("令和6年は2024を返す", () => {
    const year = extractYearFromTitle("洞爺湖町議会令和６年３月会議");
    expect(year).toBe(2024);
  });

  it("平成30年は2018を返す", () => {
    const year = extractYearFromTitle("洞爺湖町議会平成30年12月会議");
    expect(year).toBe(2018);
  });

  it("和暦が含まれない場合はnullを返す", () => {
    const year = extractYearFromTitle("会議録");
    expect(year).toBeNull();
  });
});

describe("parseTable", () => {
  it("テーブルから会議情報を抽出する", () => {
    const html = `
      <table class="color1">
        <thead>
          <tr><td colspan="7"><b><i>洞爺湖町議会令和７年９月会議</i></b></td></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/20250305目次.pdf">目次等</a></td>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/20250910洞爺湖町９月会議１号.pdf">第１日目（９月１０日）</a></td>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/20250911洞爺湖町９月会議２号.pdf">第２日目（９月１１日）</a></td>
            <td>－</td>
          </tr>
        </tbody>
      </table>
    `;
    const meetings = parseTable(html);
    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("洞爺湖町議会令和７年９月会議");
    expect(meetings[0]!.heldOn).toBe("2025-09-01"); // 目次は月初日
    expect(meetings[1]!.heldOn).toBe("2025-09-10");
    expect(meetings[2]!.heldOn).toBe("2025-09-11");
  });

  it("tbodyがないテーブルは空配列を返す", () => {
    const html = `
      <table class="color1">
        <thead><tr><td>洞爺湖町議会令和７年９月会議</td></tr></thead>
      </table>
    `;
    const meetings = parseTable(html);
    expect(meetings).toHaveLength(0);
  });

  it("PDFリンクがないテーブルは空配列を返す", () => {
    const html = `
      <table class="color1">
        <thead><tr><td>洞爺湖町議会令和７年９月会議</td></tr></thead>
        <tbody><tr><td>－</td><td>－</td></tr></tbody>
      </table>
    `;
    const meetings = parseTable(html);
    expect(meetings).toHaveLength(0);
  });

  it("相対パスのPDF URLを絶対URLに変換する", () => {
    const html = `
      <table class="color1">
        <thead><tr><td>洞爺湖町議会平成26年12月会議</td></tr></thead>
        <tbody>
          <tr>
            <td><a href="/upload/files/04_ town_administration/town_council/H2612_01.pdf">第１日目（12月10日）</a></td>
          </tr>
        </tbody>
      </table>
    `;
    const meetings = parseTable(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("http://www.town.toyako.hokkaido.jp");
  });

  it("plenary会議は meetingType が plenary になる", () => {
    const html = `
      <table class="color1">
        <thead><tr><td>洞爺湖町議会令和７年３月会議</td></tr></thead>
        <tbody>
          <tr>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/test.pdf">第１日目（３月１日）</a></td>
          </tr>
        </tbody>
      </table>
    `;
    const meetings = parseTable(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("plenary");
  });
});

describe("parseYearPage", () => {
  it("複数のテーブルから会議情報を抽出する", () => {
    const html = `
      <div>
        <table class="color1">
          <thead><tr><td><b><i>洞爺湖町議会令和７年９月会議</i></b></td></tr></thead>
          <tbody>
            <tr>
              <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/20250910_1.pdf">第１日目（９月１０日）</a></td>
            </tr>
          </tbody>
        </table>
        <table class="color1">
          <thead><tr><td><b><i>洞爺湖町議会令和７年３月会議</i></b></td></tr></thead>
          <tbody>
            <tr>
              <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/20250301_1.pdf">第１日目（３月１日）</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-09-10");
    expect(meetings[1]!.heldOn).toBe("2025-03-01");
  });

  it("color1クラス以外のテーブルは無視する", () => {
    const html = `
      <table class="other">
        <tbody>
          <tr>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/other.pdf">その他</a></td>
          </tr>
        </tbody>
      </table>
      <table class="color1">
        <thead><tr><td>洞爺湖町議会令和７年９月会議</td></tr></thead>
        <tbody>
          <tr>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/20250910_1.pdf">第１日目（９月１０日）</a></td>
          </tr>
        </tbody>
      </table>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-09-10");
  });

  it("同じPDF URLは重複を除外する", () => {
    const html = `
      <table class="color1">
        <thead><tr><td>洞爺湖町議会令和７年９月会議</td></tr></thead>
        <tbody>
          <tr>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/dup.pdf">第１日目（９月１０日）</a></td>
            <td><a href="http://www.town.toyako.hokkaido.jp/upload/files/dup.pdf">第１日目（再掲）</a></td>
          </tr>
        </tbody>
      </table>
    `;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("テーブルがない場合は空配列を返す", () => {
    const html = `<p>会議録はありません。</p>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });
});
