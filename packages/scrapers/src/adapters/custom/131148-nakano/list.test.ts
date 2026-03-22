import { describe, expect, test } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  test("検索結果 HTML から会議ドキュメントを抽出する", () => {
    const html = `
      <table>
        <tr class="td2" id="tr7107" onmouseover="cellOver(7107)" onmouseout="cellOut(7107)">
          <td class="td2" width="450"><p style="margin: 1em;">
            <a href="https://kugikai-nakano.jp/view.html?gijiroku_id=7107&s=&#S1" target="kaigi">
            令和７年１２月１０日中野区議会本会議（第４回定例会）</a></p></td>
          <td class="td2" width="150" align="center">
            <a href="...">令和7年12月10日</a></td>
          <td class="td2" width="200" align="center">
            <a href="...">-</a></td>
        </tr>
        <tr class="td2" id="tr7100" onmouseover="cellOver(7100)" onmouseout="cellOut(7100)">
          <td class="td2" width="450"><p style="margin: 1em;">
            <a href="https://kugikai-nakano.jp/view.html?gijiroku_id=7100&s=&#S1" target="kaigi">
            令和７年１１月２５日中野区議会本会議（第４回定例会）</a></p></td>
          <td class="td2" width="150" align="center">
            <a href="...">令和7年11月25日</a></td>
          <td class="td2" width="200" align="center">
            <a href="...">-</a></td>
        </tr>
      </table>
    `;

    const documents = parseListPage(html);
    expect(documents).toHaveLength(2);
    expect(documents[0]!.gijirokuId).toBe("7107");
    expect(documents[0]!.title).toBe("令和７年１２月１０日中野区議会本会議（第４回定例会）");
    expect(documents[0]!.heldOn).toBe("2025-12-10");
    expect(documents[1]!.gijirokuId).toBe("7100");
    expect(documents[1]!.heldOn).toBe("2025-11-25");
  });

  test("同一 gijiroku_id の重複を排除する", () => {
    const html = `
      <tr id="tr7107"><td><a href="view.html?gijiroku_id=7107">令和７年１２月１０日中野区議会本会議</a></td><td>令和7年12月10日</td></tr>
      <tr id="tr7107"><td><a href="view.html?gijiroku_id=7107">令和７年１２月１０日中野区議会本会議</a></td><td>令和7年12月10日</td></tr>
    `;

    const documents = parseListPage(html);
    expect(documents).toHaveLength(1);
  });

  test("検索結果が空の場合は空配列を返す", () => {
    const html = `<table><tr><td>検索結果なし</td></tr></table>`;
    const documents = parseListPage(html);
    expect(documents).toHaveLength(0);
  });

  test("日付が解析できない行はスキップする", () => {
    const html = `
      <tr id="tr9999"><td><a href="view.html?gijiroku_id=9999">不正なタイトル</a></td><td>不正な日付</td></tr>
    `;
    const documents = parseListPage(html);
    expect(documents).toHaveLength(0);
  });
});
