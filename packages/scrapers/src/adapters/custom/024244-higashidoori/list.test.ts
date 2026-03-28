import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会・臨時会の開催一覧を抽出し、開始日を heldOn にする", () => {
    const html = `
      <table summary="これまでの定例会・臨時会開催期間">
        <tbody>
          <tr>
            <th>定例会・臨時会</th>
            <th>開催日・期間</th>
          </tr>
          <tr>
            <td>令和8年3月第1回定例会</td>
            <td>令和8年3月9日～3月17日</td>
          </tr>
          <tr>
            <td>令和8年2月第1回臨時会</td>
            <td>令和8年2月24日</td>
          </tr>
          <tr>
            <td>参考情報</td>
            <td>令和8年2月1日</td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseListPage(html)).toEqual([
      {
        title: "令和8年3月第1回定例会",
        heldOn: "2026-03-09",
      },
      {
        title: "令和8年2月第1回臨時会",
        heldOn: "2026-02-24",
      },
    ]);
  });

  it("平成表記の行も抽出する", () => {
    const html = `
      <table summary="これまでの定例会・臨時会開催期間">
        <tbody>
          <tr>
            <td>平成31年3月第1回定例会</td>
            <td>平成31年3月8日～3月15日</td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseListPage(html)).toEqual([
      {
        title: "平成31年3月第1回定例会",
        heldOn: "2019-03-08",
      },
    ]);
  });
});
