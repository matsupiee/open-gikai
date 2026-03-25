import { describe, it, expect } from "vitest";
import { parseListPage, parseDateFromCategory, parseCategoryName } from "./list";

describe("parseDateFromCategory", () => {
  it("令和の年号と開始日から YYYY-MM-DD を返す", () => {
    expect(parseDateFromCategory("第1回定例会（令和6年3月6日～3月13日）")).toBe("2024-03-06");
  });

  it("平成の年号と開始日から YYYY-MM-DD を返す", () => {
    expect(parseDateFromCategory("第1回定例会（平成28年3月8日～3月15日）")).toBe("2016-03-08");
  });

  it("単一日の臨時会を正しく処理する", () => {
    expect(parseDateFromCategory("第1回臨時会（令和6年1月19日）")).toBe("2024-01-19");
  });

  it("特別委員会の日程を正しく処理する", () => {
    expect(parseDateFromCategory("予算審査特別委員会（令和6年3月8日～3月12日）")).toBe("2024-03-08");
  });

  it("令和元年を正しく変換する", () => {
    expect(parseDateFromCategory("第1回臨時会（令和元年5月27日）")).toBe("2019-05-27");
  });

  it("1桁の月日をゼロ埋めする", () => {
    expect(parseDateFromCategory("第1回定例会（令和6年3月6日～3月13日）")).toBe("2024-03-06");
  });

  it("年号が不正な場合は null を返す", () => {
    expect(parseDateFromCategory("無効なテキスト")).toBeNull();
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromCategory("令和6年会議")).toBeNull();
  });
});

describe("parseCategoryName", () => {
  it("括弧前の会議種別名を返す", () => {
    expect(parseCategoryName("第1回定例会（令和6年3月6日～3月13日）")).toBe("第1回定例会");
  });

  it("全角数字を半角に正規化する", () => {
    expect(parseCategoryName("第１回定例会（令和6年3月6日）")).toBe("第1回定例会");
  });

  it("臨時会を正しく返す", () => {
    expect(parseCategoryName("第1回臨時会（令和6年1月19日）")).toBe("第1回臨時会");
  });

  it("特別委員会を正しく返す", () => {
    expect(parseCategoryName("予算審査特別委員会（令和6年3月8日～3月12日）")).toBe("予算審査特別委員会");
  });

  it("括弧がない場合はテキスト全体を返す", () => {
    expect(parseCategoryName("第1回定例会")).toBe("第1回定例会");
  });
});

describe("parseListPage", () => {
  it("テーブルから PDF リンクを正しく抽出する", () => {
    const html = `
      <table>
        <thead><tr><th scope="row">区分</th><th scope="col">PDF</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">第1回定例会（令和6年3月6日～3月13日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/r6-1teireikai.pdf">令和6年第1回定例会(PDFファイル:3.5MB)</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第1回定例会（令和6年3月6日～3月13日）");
    expect(meetings[0]!.heldOn).toBe("2024-03-06");
    expect(meetings[0]!.category).toBe("第1回定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ozora.hokkaido.jp/material/files/group/21/r6-1teireikai.pdf",
    );
  });

  it("複数行のテーブルを正しく処理する", () => {
    const html = `
      <table>
        <thead><tr><th scope="row">区分</th><th scope="col">PDF</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">第1回定例会（令和6年3月6日～3月13日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/r6-1teireikai.pdf">令和6年第1回定例会</a></td>
          </tr>
          <tr>
            <th scope="row">第1回臨時会（令和6年1月19日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/r6-1rinnjikai.pdf">令和6年第1回臨時会</a></td>
          </tr>
          <tr>
            <th scope="row">予算審査特別委員会（令和6年3月8日～3月12日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/r6-yosannsihinsa.pdf">令和6年予算審査特別委員会</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-03-06");
    expect(meetings[0]!.category).toBe("第1回定例会");
    expect(meetings[1]!.heldOn).toBe("2024-01-19");
    expect(meetings[1]!.category).toBe("第1回臨時会");
    expect(meetings[2]!.heldOn).toBe("2024-03-08");
    expect(meetings[2]!.category).toBe("予算審査特別委員会");
  });

  it("平成年度のデータを正しくパースする", () => {
    const html = `
      <table>
        <thead><tr><th scope="row">区分</th><th scope="col">PDF</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">第1回定例会（平成28年3月8日～3月15日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/H28teireikaikaigiroku001.pdf">平成28年第1回定例会</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2016-03-08");
    expect(meetings[0]!.category).toBe("第1回定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ozora.hokkaido.jp/material/files/group/21/H28teireikaikaigiroku001.pdf",
    );
  });

  it("PDF リンクがない行はスキップする", () => {
    const html = `
      <table>
        <thead><tr><th scope="row">区分</th><th scope="col">PDF</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">第1回定例会（令和6年3月6日～3月13日）</th>
            <td>準備中</td>
          </tr>
          <tr>
            <th scope="row">第2回定例会（令和6年6月20日～6月21日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/r6-2teirei.pdf">令和6年第2回定例会</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-06-20");
  });

  it("日付が含まれない区分テキストはスキップする", () => {
    const html = `
      <table>
        <thead><tr><th scope="row">区分</th><th scope="col">PDF</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">会議録</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/test.pdf">資料</a></td>
          </tr>
          <tr>
            <th scope="row">第1回定例会（令和6年3月6日～3月13日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/r6-1teireikai.pdf">令和6年第1回定例会</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-06");
  });

  it("// で始まる URL を https: に変換する", () => {
    const html = `
      <table>
        <thead><tr><th scope="row">区分</th><th scope="col">PDF</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">第1回定例会（令和6年3月6日～3月13日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/r6-1teireikai.pdf">令和6年第1回定例会</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings[0]!.pdfUrl).toMatch(/^https:\/\//);
  });

  it("令和元年のデータを正しくパースする", () => {
    const html = `
      <table>
        <thead><tr><th scope="row">区分</th><th scope="col">PDF</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">第1回臨時会（令和元年5月27日）</th>
            <td><a href="//www.town.ozora.hokkaido.jp/material/files/group/21/0101rinji.pdf">令和元年第1回臨時会</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-05-27");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });

  it("テーブルがない HTML は空配列を返す", () => {
    expect(parseListPage("<div>テキストのみ</div>")).toEqual([]);
  });
});
