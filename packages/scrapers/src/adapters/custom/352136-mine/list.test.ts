import { describe, expect, it } from "vitest";
import { parseListPage, extractHeldOn } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第4回定例会会議録")).toBe(2024);
    expect(parseWarekiYear("令和7年第1回臨時会会議録")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回定例会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第4回定例会会議録")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和6年第4回定例会会議録")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和6年第1回臨時会会議録")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会会議録")).toBe("committee");
  });
});

describe("extractHeldOn", () => {
  it("括弧内の月日を抽出する（令和年付き）", () => {
    expect(extractHeldOn("令和6年第4回定例会会議録（令和6年12月10日）", 2024)).toBe("2024-12-10");
  });

  it("括弧内の月日を抽出する（月日のみ）", () => {
    expect(extractHeldOn("令和6年第4回定例会会議録（12月10日）", 2024)).toBe("2024-12-10");
  });

  it("括弧なしの月日を抽出する", () => {
    expect(extractHeldOn("令和6年第4回定例会会議録 12月10日", 2024)).toBe("2024-12-10");
  });

  it("1桁の月日をゼロパディングする", () => {
    expect(extractHeldOn("令和6年第1回臨時会会議録（3月5日）", 2024)).toBe("2024-03-05");
  });

  it("日付が含まれない場合はnullを返す", () => {
    expect(extractHeldOn("令和6年第4回定例会会議録", 2024)).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDF リンクから会議録情報を抽出する", () => {
    const html = `
      <div class="list">
        <ul>
          <li><a href="/soshiki/gikai/gijiroku/r6-4.pdf">令和6年第4回定例会会議録（令和6年12月10日）</a></li>
          <li><a href="/soshiki/gikai/gijiroku/r6-3.pdf">令和6年第3回定例会会議録（令和6年9月12日）</a></li>
          <li><a href="/soshiki/gikai/gijiroku/r6-rin.pdf">令和6年第1回臨時会会議録（令和6年3月15日）</a></li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和6年第4回定例会会議録",
      heldOn: "2024-12-10",
      pdfUrl: "https://www.city.mine.lg.jp/soshiki/gikai/gijiroku/r6-4.pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "令和6年第3回定例会会議録",
      heldOn: "2024-09-12",
      pdfUrl: "https://www.city.mine.lg.jp/soshiki/gikai/gijiroku/r6-3.pdf",
      meetingType: "plenary",
    });
    expect(result[2]).toEqual({
      title: "令和6年第1回臨時会会議録",
      heldOn: "2024-03-15",
      pdfUrl: "https://www.city.mine.lg.jp/soshiki/gikai/gijiroku/r6-rin.pdf",
      meetingType: "extraordinary",
    });
  });

  it("和暦を含まないPDFリンクを除外する", () => {
    const html = `
      <a href="/files/schedule.pdf">日程表[PDF]</a>
      <a href="/soshiki/gikai/gijiroku/r6-4.pdf">令和6年第4回定例会会議録（令和6年12月10日）</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第4回定例会会議録");
  });

  it("委員会を正しく分類する", () => {
    const html = `
      <a href="/soshiki/gikai/gijiroku/iinkai.pdf">令和6年総務委員会会議録（令和6年11月20日）</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("committee");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("絶対URLのhrefも正しく処理する", () => {
    const html = `
      <a href="https://www.city.mine.lg.jp/soshiki/gikai/gijiroku/r6-4.pdf">令和6年第4回定例会会議録（令和6年12月10日）</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://www.city.mine.lg.jp/soshiki/gikai/gijiroku/r6-4.pdf");
  });
});
