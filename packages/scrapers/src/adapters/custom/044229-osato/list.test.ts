import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("指定年の会議録 PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1" rowspan="19"><span>令和7年</span></th>
          <td colspan="3" rowspan="2"><strong>第4回（12月）定例会</strong></td>
          <td><a href="/uploaded/attachment/9646.pdf">12月5日会議録 [PDF]</a></td>
        </tr>
        <tr>
          <td><a href="/uploaded/attachment/9645.pdf">12月3日会議録 [PDF]</a></td>
        </tr>
        <tr>
          <td colspan="3"><strong>第3回（9月）定例会</strong></td>
          <td><a href="/uploaded/attachment/9445.pdf">9月30日会議録 [PDF]</a></td>
        </tr>
        <tr>
          <th colspan="1" rowspan="22"><span>令和6年</span></th>
          <td colspan="3"><strong>第4回（12月）定例会</strong></td>
          <td><a href="/uploaded/attachment/8711.pdf">12月6日会議録 [PDF]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.miyagi-osato.lg.jp/uploaded/attachment/9646.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2025-12-05");
    expect(meetings[0]!.title).toBe("令和7年 第4回（12月）定例会 12月5日会議録 [PDF]");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.heldOn).toBe("2025-12-03");
    expect(meetings[1]!.title).toBe("令和7年 第4回（12月）定例会 12月3日会議録 [PDF]");

    expect(meetings[2]!.heldOn).toBe("2025-09-30");
    expect(meetings[2]!.title).toBe("令和7年 第3回（9月）定例会 9月30日会議録 [PDF]");
  });

  it("対象年と異なるブロックはスキップする", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1"><span>令和8年</span></th>
          <td colspan="3"><strong>第1回（1月）臨時会</strong></td>
          <td><a href="/uploaded/attachment/9647.pdf">1月14日会議録 [PDF]</a></td>
        </tr>
        <tr>
          <th colspan="1" rowspan="19"><span>令和7年</span></th>
          <td colspan="3"><strong>第4回（12月）定例会</strong></td>
          <td><a href="/uploaded/attachment/9646.pdf">12月5日会議録 [PDF]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-12-05");
  });

  it("臨時会のリンクは meetingType が extraordinary になる", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1" rowspan="5"><span>令和7年</span></th>
          <td colspan="3"><strong>第1回（1月）臨時会</strong></td>
          <td><a href="/uploaded/attachment/8713.pdf">1月8日会議録 [PDF]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2025-01-08");
  });

  it("対象年が存在しない場合は空配列を返す", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1" rowspan="22"><span>令和6年</span></th>
          <td colspan="3"><strong>第4回（12月）定例会</strong></td>
          <td><a href="/uploaded/attachment/8711.pdf">12月6日会議録 [PDF]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1" rowspan="10"><span>令和元年</span></th>
          <td colspan="3"><strong>第2回（6月）定例会</strong></td>
          <td><a href="/uploaded/attachment/1000.pdf">6月20日会議録 [PDF]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-20");
  });

  it("平成の年度を正しく処理する", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1" rowspan="20"><span>平成28年</span></th>
          <td colspan="3"><strong>第1回（2月）臨時会</strong></td>
          <td><a href="/uploaded/attachment/935.pdf">2月15日会議録 [PDF]</a></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2016);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2016-02-15");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("<strong> が <span> 内にある構造を処理できる", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1" rowspan="5" style="text-align:center"><span style="font-size:130%">令和7年</span></th>
          <td colspan="3" style="width:32%"><span style="font-size:130%"><strong>第3回（9月）臨時会</strong></span></td>
          <td style="width:49%"><span style="font-size:130%"><a href="/uploaded/attachment/9439.pdf">9月4日会議録 [PDF]</a></span></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2025-09-04");
  });

  it("rowspan による複数行の PDF リンクを正しく処理する", () => {
    const html = `
      <table>
        <tr>
          <th colspan="1" rowspan="19"><span style="font-size:130%">令和7年</span></th>
          <td colspan="3" rowspan="3"><strong><span style="font-size:130%">第4回（12月）定例会</span></strong></td>
          <td><span style="font-size:130%"><a href="/uploaded/attachment/9646.pdf">12月5日会議録 [PDF]</a></span></td>
        </tr>
        <tr>
          <td><span style="font-size:130%"><a href="/uploaded/attachment/9645.pdf">12月3日会議録 [PDF]</a></span></td>
        </tr>
        <tr>
          <td><span style="font-size:130%"><a href="/uploaded/attachment/9644.pdf">12月2日会議録 [PDF]</a></span></td>
        </tr>
      </table>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2025-12-05");
    expect(meetings[1]!.heldOn).toBe("2025-12-03");
    expect(meetings[2]!.heldOn).toBe("2025-12-02");
    // rowspan で session テキストが繰り返されない行でも正しくタイトルが組み立てられる
    expect(meetings[1]!.title).toBe("令和7年 第4回（12月）定例会 12月3日会議録 [PDF]");
  });
});
