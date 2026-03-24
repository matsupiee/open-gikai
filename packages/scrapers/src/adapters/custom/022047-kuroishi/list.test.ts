import { describe, expect, it } from "vitest";
import {
  extractMonthDay,
  buildDateString,
  parseSessionsForYear,
} from "./list";

describe("extractMonthDay", () => {
  it("日本語の月日を抽出する", () => {
    const result = extractMonthDay("3月15日");
    expect(result).toEqual({ month: 3, day: 15 });
  });

  it("全角数字を含む月日を抽出する", () => {
    const result = extractMonthDay("１２月３日");
    expect(result).toEqual({ month: 12, day: 3 });
  });

  it("月日が含まれない場合は null を返す", () => {
    expect(extractMonthDay("第1号")).toBeNull();
    expect(extractMonthDay("")).toBeNull();
  });
});

describe("buildDateString", () => {
  it("YYYY-MM-DD 形式で返す", () => {
    expect(buildDateString(2025, 3, 15)).toBe("2025-03-15");
    expect(buildDateString(2025, 12, 3)).toBe("2025-12-03");
    expect(buildDateString(2007, 1, 1)).toBe("2007-01-01");
  });
});

describe("parseSessionsForYear", () => {
  it("指定年の令和期定例会を抽出し補助資料をスキップする", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/R07_1T_00_C.pdf">目次</a></li>
        <li><a href="/shisei/gikai/files/R07_1T_S.pdf">会期日程</a></li>
        <li><a href="/shisei/gikai/files/R07_1T_T.pdf">一般質問通告表</a></li>
        <li><a href="/shisei/gikai/files/R07_1T_G_0314.pdf">審議議案</a></li>
        <li><a href="/shisei/gikai/files/R07_1T_01.pdf">第1号3月15日</a></li>
        <li><a href="/shisei/gikai/files/R07_1T_02.pdf">第2号3月16日</a></li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("2025年第1回定例会第1号");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "http://www.city.kuroishi.aomori.jp/shisei/gikai/files/R07_1T_01.pdf"
    );
    expect(result[0]!.heldOn).toBe("2025-03-15");
    expect(result[1]!.title).toBe("2025年第1回定例会第2号");
    expect(result[1]!.heldOn).toBe("2025-03-16");
  });

  it("臨時会を extraordinary として抽出する", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/R07_1R_01.pdf">第1号5月10日</a></li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("2025年第1回臨時会第1号");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2025-05-10");
  });

  it("平成期の定例会を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/H19_1_1.pdf">第1号3月1日</a></li>
        <li><a href="/shisei/gikai/files/H19_1_contents.pdf">目次</a></li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2007);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("2007年第1回定例会第1号");
    expect(result[0]!.heldOn).toBe("2007-03-01");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("平成期の臨時会を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/H19_1R_1.pdf">第1号6月20日</a></li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2007);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.title).toBe("2007年第1回臨時会第1号");
  });

  it("指定年以外のセッションはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/R07_1T_01.pdf">第1号3月15日</a></li>
        <li><a href="/shisei/gikai/files/R06_1T_01.pdf">第1号3月14日</a></li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toContain("2025年");
  });

  it("補助資料（Schedule, Tuukoku, Shingigian）をスキップする", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/Schedule_H27_1.pdf">会期日程</a></li>
        <li><a href="/shisei/gikai/files/Tuukoku_H27_1.pdf">一般質問通告表</a></li>
        <li><a href="/shisei/gikai/files/Shingigian_H27_1.pdf">審議議案</a></li>
        <li><a href="/shisei/gikai/files/H27_1_1.pdf">第1号3月5日</a></li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2015);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("2015年第1回定例会第1号");
  });

  it("リンクテキストに日付がない場合は heldOn が null になる", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/R07_1T_01.pdf">第1号</a></li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBeNull();
  });

  it("後続テキストから日付を抽出できる", () => {
    const html = `
      <ul>
        <li><a href="/shisei/gikai/files/R07_1T_01.pdf">第1号</a>（3月15日）</li>
      </ul>
    `;

    const result = parseSessionsForYear(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-03-15");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parseSessionsForYear(html, 2025)).toEqual([]);
  });
});
