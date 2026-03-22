import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会のリンクを正しく抽出する", () => {
    const html = `
      <h3>令和７年第１回定例会</h3>
      <table style="width:95%">
      <tbody>
      <tr>
        <td><p style="text-align: center;"><a href="/site/gikai/kaigiroku2025-1-1.html">第１号（２月25日）</a></p></td>
        <td>　議案上程、説明、質疑、委員会付託</td>
      </tr>
      <tr>
        <td><p style="text-align: center;"><a href="/site/gikai/kaigiroku2025-1-2.html">第２号（３月４日）</a></p></td>
        <td>　一般質問・予算質疑（代表）</td>
      </tr>
      </tbody>
      </table>
    `;

    const documents = parseListPage(html, 2025);

    expect(documents).toHaveLength(2);
    expect(documents[0]!.year).toBe(2025);
    expect(documents[0]!.session).toBe(1);
    expect(documents[0]!.number).toBe(1);
    expect(documents[0]!.sessionTitle).toBe("令和７年第１回定例会");
    expect(documents[0]!.heldOn).toBe("2025-02-25");
    expect(documents[0]!.path).toBe("/site/gikai/kaigiroku2025-1-1.html");
    expect(documents[1]!.heldOn).toBe("2025-03-04");
  });

  it("臨時会のリンクを正しく抽出する", () => {
    const html = `
      <h3>令和７年第２回臨時会</h3>
      <table style="width:95%">
      <tbody>
      <tr>
        <td><p style="text-align: center;"><a href="/site/gikai/kaigiroku2025-2-1.html">第１号（５月15日）</a></p></td>
        <td>　議案上程、説明、質疑、討論、採決</td>
      </tr>
      </tbody>
      </table>
    `;

    const documents = parseListPage(html, 2025);

    expect(documents).toHaveLength(1);
    expect(documents[0]!.session).toBe(2);
    expect(documents[0]!.number).toBe(1);
    expect(documents[0]!.sessionTitle).toBe("令和７年第２回臨時会");
    expect(documents[0]!.heldOn).toBe("2025-05-15");
  });

  it("複数セクションからドキュメントを抽出する", () => {
    const html = `
      <h3>令和７年第１回定例会</h3>
      <table><tbody>
        <tr><td><p><a href="/site/gikai/kaigiroku2025-1-1.html">第１号（２月25日）</a></p></td></tr>
      </tbody></table>
      <h3>令和７年第２回臨時会</h3>
      <table><tbody>
        <tr><td><p><a href="/site/gikai/kaigiroku2025-2-1.html">第１号（５月15日）</a></p></td></tr>
      </tbody></table>
    `;

    const documents = parseListPage(html, 2025);

    expect(documents).toHaveLength(2);
    expect(documents[0]!.sessionTitle).toBe("令和７年第１回定例会");
    expect(documents[1]!.sessionTitle).toBe("令和７年第２回臨時会");
  });

  it("リンクが無いセクションは空配列を返す", () => {
    const html = `<h3>令和７年第１回定例会</h3><table></table>`;

    const documents = parseListPage(html, 2025);
    expect(documents).toHaveLength(0);
  });

  it("全角数字の日付を正しくパースする", () => {
    const html = `
      <h3>令和６年第４回定例会</h3>
      <table><tbody>
        <tr><td><p><a href="/site/gikai/kaigiroku2024-4-1.html">第１号（９月２日）</a></p></td></tr>
      </tbody></table>
    `;

    const documents = parseListPage(html, 2024);

    expect(documents).toHaveLength(1);
    expect(documents[0]!.heldOn).toBe("2024-09-02");
  });
});
