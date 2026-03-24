import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会の会議録リンクを正しく抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年</td>
          <td>12月</td>
          <td>定例会</td>
          <td><a href="/gikai/2026022500029/">日程</a></td>
          <td><a href="/gikai/2026022500030/">議案</a></td>
          <td><a href="/gikai/top/file_contents/r0712.pdf">賛否</a></td>
          <td>
            <a href="/gikai/2026022500031/">第1号</a>
            <a href="/gikai/2026022500032/">第2号</a>
          </td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.year).toBe(2025);
    expect(docs[0]!.sessionTitle).toBe("令和7年12月定例会");
    expect(docs[0]!.meetingKind).toBe("定例会");
    expect(docs[0]!.path).toBe("/gikai/2026022500031/");
    expect(docs[0]!.detailUrl).toBe(
      "https://www.city.yawatahama.ehime.jp/gikai/2026022500031/",
    );
    expect(docs[1]!.path).toBe("/gikai/2026022500032/");
  });

  it("臨時会を正しく識別する", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年</td>
          <td>9月3日</td>
          <td>臨時会</td>
          <td></td>
          <td></td>
          <td></td>
          <td><a href="/gikai/2025090300001/">第1号</a></td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.meetingKind).toBe("臨時会");
    expect(docs[0]!.heldOn).toBe("2025-09-03");
    expect(docs[0]!.year).toBe(2025);
  });

  it("平成の年号を正しく変換する", () => {
    const html = `
      <table>
        <tr>
          <td>平成30年</td>
          <td>12月</td>
          <td>定例会</td>
          <td></td><td></td><td></td>
          <td><a href="/gikai/2018120000001/">第1号</a></td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.year).toBe(2018);
    expect(docs[0]!.sessionTitle).toBe("平成30年12月定例会");
  });

  it("令和元年を正しく変換する", () => {
    const html = `
      <table>
        <tr>
          <td>令和元年</td>
          <td>6月</td>
          <td>定例会</td>
          <td></td><td></td><td></td>
          <td><a href="/gikai/2019060000001/">第1号</a></td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.year).toBe(2019);
  });

  it("全角数字の年号を正しく変換する", () => {
    const html = `
      <table>
        <tr>
          <td>令和７年</td>
          <td>３月</td>
          <td>定例会</td>
          <td></td><td></td><td></td>
          <td><a href="/gikai/2025030000001/">第1号</a></td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.year).toBe(2025);
    expect(docs[0]!.sessionTitle).toBe("令和７年3月定例会");
  });

  it("日付付きの臨時会の heldOn を正しくパースする", () => {
    const html = `
      <table>
        <tr>
          <td>令和6年</td>
          <td>11月15日</td>
          <td>臨時会</td>
          <td></td><td></td><td></td>
          <td><a href="/gikai/2024111500001/">第1号</a></td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.heldOn).toBe("2024-11-15");
  });

  it("月のみの場合 heldOn は null になる", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年</td>
          <td>3月</td>
          <td>定例会</td>
          <td></td><td></td><td></td>
          <td><a href="/gikai/2025030000001/">第1号</a></td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.heldOn).toBeNull();
  });

  it("会議録リンクがない行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年</td>
          <td>12月</td>
          <td>定例会</td>
          <td><a href="/gikai/top/file_contents/r0712.pdf">賛否PDF</a></td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);
    expect(docs).toHaveLength(0);
  });

  it("重複した URL を除外する", () => {
    const html = `
      <table>
        <tr>
          <td>令和7年</td>
          <td>12月</td>
          <td>定例会</td>
          <td></td><td></td><td></td>
          <td>
            <a href="/gikai/2026022500031/">第1号</a>
            <a href="/gikai/2026022500031/">第1号（再）</a>
          </td>
        </tr>
      </table>
    `;

    const docs = parseListPage(html);
    expect(docs).toHaveLength(1);
  });
});
