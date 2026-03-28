import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("年度ごとの表から PDF リンクを抽出する", () => {
    const html = `
      <p>令和６年</p>
      <table>
        <tbody>
          <tr>
            <td>会議名</td>
            <td>会期</td>
          </tr>
          <tr>
            <td>第１回定例会<a class="iconFile iconPdf" href="file_contents/060711.pdf">[PDF：1.36MB]</a></td>
            <td>令和６年３月７日(木)～令和６年３月18日(月)</td>
          </tr>
          <tr>
            <td>第２回臨時会<a class="iconFile iconPdf" href="file_contents/R6_2_28.pdf">[PDF：166KB]</a></td>
            <td><p>令和６年２月28日(水)</p></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(
      html,
      "https://www.higashikushira.com/docs/2018012400051/",
    );

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("第1回定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.higashikushira.com/docs/2018012400051/file_contents/060711.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-03-07");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.headingYear).toBe(2024);

    expect(meetings[1]!.title).toBe("第2回臨時会");
    expect(meetings[1]!.heldOn).toBe("2024-02-28");
    expect(meetings[1]!.meetingType).toBe("extraordinary");
  });

  it("令和元年見出しと平成31年の日付を 2019 年として扱う", () => {
    const html = `
      <p>令和元年</p>
      <table>
        <tbody>
          <tr>
            <td>第１回臨時会<a href="file_contents/H31_02.pdf">[PDF：158KB]</a></td>
            <td>平成31年２月４日(月)</td>
          </tr>
          <tr>
            <td>第２回定例会<a href="file_contents/R01_6.pdf">[PDF：1MB]</a></td>
            <td>令和元年6月11日(火)～令和元年6月20日(木)</td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("第1回臨時会");
    expect(meetings[0]!.heldOn).toBe("2019-02-04");
    expect(meetings[0]!.headingYear).toBe(2019);
    expect(meetings[1]!.heldOn).toBe("2019-06-11");
  });

  it("平成30年の会議も抽出する", () => {
    const html = `
      <p>平成30年</p>
      <table>
        <tbody>
          <tr>
            <td>第３回臨時会<a href="file_contents/H30_11.pdf">[PDF：221KB]</a></td>
            <td>平成30年11月26日(月)</td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第3回臨時会");
    expect(meetings[0]!.heldOn).toBe("2018-11-26");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.headingYear).toBe(2018);
  });

  it("PDF リンクがない行は無視する", () => {
    const html = `
      <p>令和６年</p>
      <table>
        <tbody>
          <tr>
            <td>会議名</td>
            <td>会期</td>
          </tr>
          <tr>
            <td>参考資料</td>
            <td>令和６年３月７日(木)</td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseListPage(html)).toEqual([]);
  });
});
