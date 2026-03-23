import { describe, expect, it } from "vitest";
import { parseSessionLinks, extractPdfRecords } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第4回定例会会議録")).toBe(2025);
    expect(parseWarekiYear("令和6年第1回臨時会会議録")).toBe(2024);
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
    expect(detectMeetingType("令和7年第4回定例会会議録")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和7年第1回臨時会会議録")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会会議録")).toBe("committee");
  });
});

describe("parseSessionLinks", () => {
  it("一覧ページから会期別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gikai/docs/2026022700023/">令和7年第4回定例会会議録</a></li>
        <li><a href="/gikai/docs/2025112600021/">令和7年第3回定例会会議録</a></li>
        <li><a href="/gikai/docs/2025112600014/">令和7年第1回臨時会会議録</a></li>
      </ul>
    `;

    const result = parseSessionLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和7年第4回定例会会議録",
      url: "https://www.city.awa.lg.jp/gikai/docs/2026022700023/",
      pageId: "2026022700023",
    });
    expect(result[1]).toEqual({
      title: "令和7年第3回定例会会議録",
      url: "https://www.city.awa.lg.jp/gikai/docs/2025112600021/",
      pageId: "2025112600021",
    });
    expect(result[2]).toEqual({
      title: "令和7年第1回臨時会会議録",
      url: "https://www.city.awa.lg.jp/gikai/docs/2025112600014/",
      pageId: "2025112600014",
    });
  });

  it("会議録以外のリンクを除外する", () => {
    const html = `
      <a href="/gikai/docs/2026022700023/">令和7年第4回定例会会議録</a>
      <a href="/gikai/docs/1234567890123/">議会だよりのご案内</a>
      <a href="/gikai/docs/9999999999999/">議員名簿</a>
    `;

    const result = parseSessionLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年第4回定例会会議録");
  });

  it("重複するページIDを除外する", () => {
    const html = `
      <a href="/gikai/docs/2026022700023/">令和7年第4回定例会会議録</a>
      <a href="/gikai/docs/2026022700023/">令和7年第4回定例会会議録</a>
    `;

    const result = parseSessionLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseSessionLinks(html)).toEqual([]);
  });
});

describe("extractPdfRecords", () => {
  it("PDF リンクからセッション日情報を抽出する", () => {
    const html = `
      <div>
        <a href="file_contents/kaigiroku071125.pdf">令和7年第4回定例会会議録11月25日[PDF：326KB]</a>
        <a href="file_contents/kaigiroku071127.pdf">令和7年第4回定例会会議録11月27日[PDF：450KB]</a>
        <a href="file_contents/kaigiroku071205.pdf">令和7年第4回定例会会議録12月5日[PDF：380KB]</a>
      </div>
    `;

    const result = extractPdfRecords(
      html,
      "令和7年第4回定例会会議録",
      "2026022700023",
      "https://www.city.awa.lg.jp/gikai/docs/2026022700023/"
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和7年第4回定例会 11月25日",
      heldOn: "2025-11-25",
      pdfUrl: "https://www.city.awa.lg.jp/gikai/docs/2026022700023/file_contents/kaigiroku071125.pdf",
      meetingType: "plenary",
      pageId: "2026022700023",
    });
    expect(result[1]!.heldOn).toBe("2025-11-27");
    expect(result[2]!.heldOn).toBe("2025-12-05");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <a href="file_contents/kaigiroku070507.pdf">令和7年第1回臨時会会議録5月7日[PDF：200KB]</a>
    `;

    const result = extractPdfRecords(
      html,
      "令和7年第1回臨時会会議録",
      "2025112600014",
      "https://www.city.awa.lg.jp/gikai/docs/2025112600014/"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("旧形式のPDFファイル名でも抽出できる", () => {
    const html = `
      <a href="file_contents/2021022200023_gikai_docs_2021022200023_file_contents_241125.pdf">令和2年第4回定例会会議録11月25日[PDF：300KB]</a>
    `;

    const result = extractPdfRecords(
      html,
      "令和2年第4回定例会会議録",
      "2021022200023",
      "https://www.city.awa.lg.jp/gikai/docs/2021022200023/"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2020-11-25");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.awa.lg.jp/gikai/docs/2021022200023/file_contents/2021022200023_gikai_docs_2021022200023_file_contents_241125.pdf"
    );
  });

  it("日付を含まないリンクを除外する", () => {
    const html = `
      <a href="file_contents/schedule.pdf">会期日程[PDF：100KB]</a>
      <a href="file_contents/kaigiroku071125.pdf">令和7年第4回定例会会議録11月25日[PDF：326KB]</a>
    `;

    const result = extractPdfRecords(
      html,
      "令和7年第4回定例会会議録",
      "2026022700023",
      "https://www.city.awa.lg.jp/gikai/docs/2026022700023/"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-11-25");
  });

  it("和暦が解析できないタイトルでは空配列を返す", () => {
    const html = `
      <a href="file_contents/test.pdf">会議録6月1日[PDF：100KB]</a>
    `;

    const result = extractPdfRecords(
      html,
      "Unknown Title",
      "9999",
      "https://www.city.awa.lg.jp/gikai/docs/9999/"
    );

    expect(result).toEqual([]);
  });
});
