import { describe, it, expect } from "vitest";
import {
  parseYearPage,
  parseHeadingDate,
  extractDateFromLinkText,
  extractDateFromHeading,
} from "./list";

describe("parseHeadingDate", () => {
  it("令和の定例会見出しをパースする", () => {
    const result = parseHeadingDate(
      "令和7年第4回定例会（令和7年12月8日から12月12日）"
    );
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2025);
    expect(result!.sessionLabel).toBe("第4回定例会");
  });

  it("令和の臨時会見出しをパースする", () => {
    const result = parseHeadingDate(
      "令和7年第4回臨時会（令和7年11月10日）"
    );
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2025);
    expect(result!.sessionLabel).toBe("第4回臨時会");
  });

  it("平成の定例会見出しをパースする", () => {
    const result = parseHeadingDate(
      "第1回定例会（平成22年3月10日から17日）"
    );
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2010);
    expect(result!.sessionLabel).toBe("第1回定例会");
  });

  it("令和元年をパースする", () => {
    const result = parseHeadingDate(
      "令和元年第1回定例会（令和元年3月7日から3月15日）"
    );
    expect(result).not.toBeNull();
    expect(result!.westernYear).toBe(2019);
    expect(result!.sessionLabel).toBe("第1回定例会");
  });

  it("会議見出しでない場合は null を返す", () => {
    expect(parseHeadingDate("本会議会議録の公開")).toBeNull();
  });
});

describe("extractDateFromLinkText", () => {
  it("全角カッコ内の月日を抽出する", () => {
    expect(
      extractDateFromLinkText(
        "令和7年第4回定例会1日目会議録第1号（12月8日）",
        2025
      )
    ).toBe("2025-12-08");
  });

  it("半角カッコ内の月日を抽出する", () => {
    expect(
      extractDateFromLinkText(
        "令和6年第4回定例会1日目会議録第1号(12月9日)",
        2024
      )
    ).toBe("2024-12-09");
  });

  it("和暦の完全日付を抽出する", () => {
    expect(
      extractDateFromLinkText(
        "第1回定例会（1日目）平成22年3月10日",
        2010
      )
    ).toBe("2010-03-10");
  });

  it("日付がない場合は null を返す", () => {
    expect(
      extractDateFromLinkText(
        "令和6年第3回臨時会　別海町議会会議録第1号",
        2024
      )
    ).toBeNull();
  });
});

describe("extractDateFromHeading", () => {
  it("見出しから単一日付を抽出する", () => {
    expect(
      extractDateFromHeading("令和7年第4回臨時会（令和7年11月10日）")
    ).toBe("2025-11-10");
  });

  it("期間の見出しからは開始日を抽出する", () => {
    expect(
      extractDateFromHeading(
        "令和7年第4回定例会（令和7年12月8日から12月12日）"
      )
    ).toBe("2025-12-08");
  });

  it("日付がない見出しは null を返す", () => {
    expect(extractDateFromHeading("定例会")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("令和の定例会と臨時会の PDF リンクを抽出する", () => {
    const html = `
      <div>
        <h2>定例会</h2>
        <h3>令和7年第4回定例会（令和7年12月8日から12月12日）</h3>
        <ul>
          <li><a href="/resources/output/contents/file/release/6679/80913/R7.4kaigiroku1.pdf" title="令和7年第4回定例会1日目会議録第1号（12月8日）">令和7年第4回定例会1日目会議録第1号（12月8日）</a>(PDF形式：440KB)</li>
          <li><a href="/resources/output/contents/file/release/6679/80913/R7.4kaigiroku2.pdf" title="令和7年第4回定例会2日目会議録第2号（12月9日）">令和7年第4回定例会2日目会議録第2号（12月9日）</a>(PDF形式：500KB)</li>
        </ul>
        <h3>令和7年第3回定例会（令和7年9月8日から9月12日）</h3>
        <ul>
          <li><a href="/resources/output/contents/file/release/6679/78712/R7.3kaigiroku1.pdf" title="令和7年第3回定例会1日目会議録第1号（9月8日）">令和7年第3回定例会1日目会議録第1号（9月8日）</a>(PDF形式：300KB)</li>
        </ul>
        <h2>臨時会</h2>
        <h3>令和7年第4回臨時会（令和7年11月10日）</h3>
        <ul>
          <li><a href="/resources/output/contents/file/release/6679/80552/R7-4-rinjikai-kaigiroku.pdf" title="令和7年第4回臨時会　別海町議会会議録第1号">令和7年第4回臨時会　別海町議会会議録第1号</a>(PDF形式：223KB)</li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(4);

    // 定例会1件目
    expect(meetings[0]!.title).toBe(
      "令和7年第4回定例会1日目会議録第1号（12月8日）"
    );
    expect(meetings[0]!.heldOn).toBe("2025-12-08");
    expect(meetings[0]!.section).toBe("定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://betsukai.jp/resources/output/contents/file/release/6679/80913/R7.4kaigiroku1.pdf"
    );

    // 定例会2件目
    expect(meetings[1]!.heldOn).toBe("2025-12-09");
    expect(meetings[1]!.section).toBe("定例会");

    // 別の定例会
    expect(meetings[2]!.heldOn).toBe("2025-09-08");
    expect(meetings[2]!.section).toBe("定例会");

    // 臨時会
    expect(meetings[3]!.title).toBe(
      "令和7年第4回臨時会　別海町議会会議録第1号"
    );
    expect(meetings[3]!.heldOn).toBe("2025-11-10");
    expect(meetings[3]!.section).toBe("臨時会");
    expect(meetings[3]!.pdfUrl).toBe(
      "https://betsukai.jp/resources/output/contents/file/release/6679/80552/R7-4-rinjikai-kaigiroku.pdf"
    );
  });

  it("平成の PDF リンクを抽出する", () => {
    const html = `
      <div>
        <h2>定例会</h2>
        <h3>第1回定例会（平成22年3月10日から17日）</h3>
        <ul>
          <li><a href="/resources/output/contents/file/release/2379/25099/H22.3.10_1.pdf" title="第1回定例会（1日目）平成22年3月10日">第1回定例会（1日目）平成22年3月10日</a>(PDF形式：300KB)</li>
          <li><a href="/resources/output/contents/file/release/2379/25099/H22.3.11_2.pdf" title="第1回定例会（2日目）平成22年3月11日">第1回定例会（2日目）平成22年3月11日</a>(PDF形式：200KB)</li>
        </ul>
        <h2>臨時会</h2>
        <h3>第1回臨時会（平成22年1月7日）</h3>
        <ul>
          <li><a href="/resources/output/contents/file/release/2379/25109/H22.1.7_1.pdf" title="第1回臨時会">第1回臨時会</a>(PDF形式：100KB)</li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.heldOn).toBe("2010-03-10");
    expect(meetings[0]!.section).toBe("定例会");

    expect(meetings[1]!.heldOn).toBe("2010-03-11");

    // 臨時会: リンクテキストに日付がないので h3 から取得
    expect(meetings[2]!.heldOn).toBe("2010-01-07");
    expect(meetings[2]!.section).toBe("臨時会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><h2>定例会</h2><p>準備中</p></div>`;
    expect(parseYearPage(html)).toEqual([]);
  });
});
