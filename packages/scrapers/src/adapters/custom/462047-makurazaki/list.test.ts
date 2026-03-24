import { describe, expect, it } from "vitest";
import { parseYearPage } from "./list";

describe("parseYearPage", () => {
  it("PDF リンクとメタ情報を抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li>
            <a href="/uploaded/attachment/17837.pdf">第1回臨時会（令和6年2月8日）</a>
          </li>
          <li>
            <a href="/uploaded/attachment/17838.pdf">第2回定例会（令和6年3月1日〜3月27日）</a>
          </li>
          <li>
            <a href="/uploaded/attachment/18261.pdf">第4回定例会（令和6年6月7日〜6月28日）</a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.makurazaki.lg.jp/uploaded/attachment/17837.pdf",
    );
    expect(meetings[0]!.title).toBe("第1回臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-02-08");
    expect(meetings[0]!.meetingType).toBe("extraordinary");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.makurazaki.lg.jp/uploaded/attachment/17838.pdf",
    );
    expect(meetings[1]!.title).toBe("第2回定例会");
    expect(meetings[1]!.heldOn).toBe("2024-03-01");
    expect(meetings[1]!.meetingType).toBe("plenary");

    expect(meetings[2]!.title).toBe("第4回定例会");
    expect(meetings[2]!.heldOn).toBe("2024-06-07");
  });

  it("予算特別委員会を委員会として認識する", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploaded/attachment/18263.pdf">予算特別委員会（令和6年6月21日）</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("予算特別委員会");
    expect(meetings[0]!.meetingType).toBe("committee");
    expect(meetings[0]!.heldOn).toBe("2024-06-21");
  });

  it("決算特別委員会を委員会として認識する", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploaded/attachment/18654.pdf">決算特別委員会（令和6年9月17日〜9月20日）</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("決算特別委員会");
    expect(meetings[0]!.meetingType).toBe("committee");
  });

  it("日付が解析できない場合は heldOn が null になる", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploaded/attachment/99999.pdf">第1回定例会（日付不明）</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("平成の日付も正しくパースする", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploaded/attachment/1234.pdf">第2回定例会（平成30年3月5日〜3月26日）</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-03-05");
  });

  it("令和元年の日付も正しくパースする", () => {
    const html = `
      <ul>
        <li>
          <a href="/uploaded/attachment/5555.pdf">第3回定例会（令和元年9月3日〜9月27日）</a>
        </li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-09-03");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });
});
