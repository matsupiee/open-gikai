import { describe, expect, it } from "vitest";
import { parseMeetingHeading, parseListPage } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和７年第４回定例会")).toBe(2025);
    expect(parseWarekiYear("令和６年第１回臨時会")).toBe(2024);
    expect(parseWarekiYear("令和８年第１回臨時会")).toBe(2026);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第１回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成２５年第１回臨時会")).toBe(2013);
    expect(parseWarekiYear("平成３０年第４回定例会")).toBe(2018);
  });

  it("全角数字を正しく変換する", () => {
    expect(parseWarekiYear("令和８年")).toBe(2026);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和７年第４回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和８年第１回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseMeetingHeading", () => {
  it("令和の定例会を解析する", () => {
    const result = parseMeetingHeading("令和７年第４回定例会");
    expect(result).toEqual({ year: 2025, num: 4, kind: "定例会" });
  });

  it("令和の臨時会を解析する", () => {
    const result = parseMeetingHeading("令和８年第１回臨時会");
    expect(result).toEqual({ year: 2026, num: 1, kind: "臨時会" });
  });

  it("平成の定例会を解析する", () => {
    const result = parseMeetingHeading("平成２５年第１回臨時会");
    expect(result).toEqual({ year: 2013, num: 1, kind: "臨時会" });
  });

  it("令和元年を解析する", () => {
    const result = parseMeetingHeading("令和元年第２回定例会");
    expect(result).toEqual({ year: 2019, num: 2, kind: "定例会" });
  });

  it("マッチしない見出しはnullを返す", () => {
    expect(parseMeetingHeading("会議録一覧")).toBeNull();
    expect(parseMeetingHeading("小海町議会")).toBeNull();
    expect(parseMeetingHeading("")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h3 見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <div class="entry-content">
        <h3>令和８年第１回臨時会</h3>
        <p><a href="https://www.koumi-town.jp/office2/archives/abc123def456abc123def456abc123def456abc1.pdf">令和８年第１回臨時会　会議録.pdf</a></p>
        <h3>令和７年第４回定例会</h3>
        <p><a href="https://www.koumi-town.jp/office2/archives/xyz789xyz789xyz789xyz789xyz789xyz789xyz7.pdf">令和７年第４回定例会　会議録.pdf</a></p>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和８年第１回臨時会");
    expect(result[0]!.year).toBe(2026);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.koumi-town.jp/office2/archives/abc123def456abc123def456abc123def456abc1.pdf"
    );

    expect(result[1]!.title).toBe("令和７年第４回定例会");
    expect(result[1]!.year).toBe(2025);
    expect(result[1]!.meetingType).toBe("plenary");
  });

  it("複数の PDF リンクを持つ会議を正しく処理する（古い会議録）", () => {
    const html = `
      <h3>平成２５年第１回臨時会</h3>
      <p><a href="/office2/archives/files/pdf/mokuzi25.1teirei.pdf">目次</a></p>
      <p><a href="/office2/archives/files/pdf/nittei25.1teirei.pdf">日程</a></p>
      <p><a href="/office2/archives/files/pdf/ippann25.1teirei.pdf">一般質問</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("平成２５年第１回臨時会");
    expect(result[0]!.year).toBe(2013);
    expect(result[0]!.sessionKey).toBe("2013-1-臨時会-0");
    expect(result[1]!.sessionKey).toBe("2013-1-臨時会-1");
    expect(result[2]!.sessionKey).toBe("2013-1-臨時会-2");
  });

  it("相対パスの PDF URL を絶対 URL に変換する", () => {
    const html = `
      <h3>令和６年第２回定例会</h3>
      <a href="/office2/archives/files/pdf/r6_2teirei.pdf">会議録</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.koumi-town.jp/office2/archives/files/pdf/r6_2teirei.pdf"
    );
  });

  it("パースできない h3 はスキップする", () => {
    const html = `
      <h3>小海町議会について</h3>
      <a href="/test.pdf">テスト</a>
      <h3>令和７年第３回定例会</h3>
      <a href="https://www.koumi-town.jp/office2/archives/valid.pdf">会議録</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和７年第３回定例会");
  });

  it("PDF リンクがない h3 はスキップする", () => {
    const html = `
      <h3>令和８年第２回定例会</h3>
      <p>準備中</p>
      <h3>令和７年第４回定例会</h3>
      <a href="https://www.koumi-town.jp/office2/archives/valid.pdf">会議録</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2025);
  });

  it("h3 がない場合は空配列を返す", () => {
    const html = "<p>No meetings here</p>";
    expect(parseListPage(html)).toEqual([]);
  });
});
