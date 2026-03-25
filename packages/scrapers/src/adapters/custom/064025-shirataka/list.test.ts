import { describe, expect, it } from "vitest";
import { parseDateFromFilename, parseDateText, parseListPage } from "./list";

describe("parseDateText", () => {
  it("全角数字の令和の日付をパースする", () => {
    expect(parseDateText("令和７年６月５日")).toBe("2025-06-05");
  });

  it("半角数字の令和の日付をパースする", () => {
    expect(parseDateText("令和6年12月5日")).toBe("2024-12-05");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成30年3月5日")).toBe("2018-03-05");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年4月1日")).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("資料一覧")).toBeNull();
  });
});

describe("parseDateFromFilename", () => {
  it("英数字コード形式のファイル名から日付を解析する", () => {
    expect(parseDateFromFilename("r07-06t-01-1204.pdf")).toBe("2025-12-04");
  });

  it("予算委員会ファイル名から日付を解析する", () => {
    expect(parseDateFromFilename("r07-y-01-0606.pdf")).toBe("2025-06-06");
  });

  it("決算委員会ファイル名から日付を解析する", () => {
    expect(parseDateFromFilename("r07-k-01-0911.pdf")).toBe("2025-09-11");
  });

  it("日本語ファイル名から日付を解析する", () => {
    expect(parseDateFromFilename("会議録R8-2回（R8.2.16）.pdf")).toBe(
      "2026-02-16",
    );
  });

  it("対応パターンがない場合は null を返す", () => {
    expect(parseDateFromFilename("somefile.pdf")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("/secure/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <div class="contents">
        <h2>令和8年</h2>
        <table>
          <tr>
            <td><a href="/secure/12345/%E4%BC%9A%E8%AD%B0%E9%8C%B2R8-2%E5%9B%9E%EF%BC%88R8.2.16%EF%BC%89.pdf">第2回臨時会（会議録R8-2回（R8.2.16）.pdf）</a></td>
          </tr>
        </table>
        <h2>令和7年</h2>
        <table>
          <tr>
            <td><a href="/secure/11111/r07-06t-01-1204.pdf">第6回定例会 12月（r07-06t-01-1204.pdf）</a></td>
          </tr>
        </table>
      </div>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shirataka.lg.jp/secure/12345/%E4%BC%9A%E8%AD%B0%E9%8C%B2R8-2%E5%9B%9E%EF%BC%88R8.2.16%EF%BC%89.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2026-02-16");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.shirataka.lg.jp/secure/11111/r07-06t-01-1204.pdf",
    );
    expect(meetings[1]!.heldOn).toBe("2025-12-04");
  });

  it("year フィルタで対象年の会議録のみ返す", () => {
    const html = `
      <div>
        <a href="/secure/12345/%E4%BC%9A%E8%AD%B0%E9%8C%B2R8-2%E5%9B%9E%EF%BC%88R8.2.16%EF%BC%89.pdf">第2回臨時会</a>
        <a href="/secure/11111/r07-06t-01-1204.pdf">第6回定例会</a>
      </div>
    `;

    const meetings2026 = parseListPage(html, 2026);
    expect(meetings2026).toHaveLength(1);
    expect(meetings2026[0]!.heldOn).toBe("2026-02-16");

    const meetings2025 = parseListPage(html, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-12-04");
  });

  it("/secure/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <div>
        <a href="/other/somefile.pdf">その他資料</a>
        <a href="/secure/11111/r07-06t-01-1204.pdf">第6回定例会</a>
      </div>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("/secure/");
  });

  it("リンクテキストに和暦日付がある場合は優先して使う", () => {
    const html = `
      <div>
        <a href="/secure/11111/r07-06t-01-1204.pdf">第6回定例会（令和7年12月4日）</a>
      </div>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-04");
  });

  it("HTML が空の場合は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });
});
