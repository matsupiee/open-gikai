import { describe, expect, it } from "vitest";
import { parseMeetingLinks, extractPdfLinks, parseHeldOnFromHtml } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する（全角）", () => {
    expect(parseWarekiYear("令和７年第４回牟岐町議会定例会")).toBe(2025);
    expect(parseWarekiYear("令和６年第１回牟岐町議会臨時会")).toBe(2024);
  });

  it("令和の年を変換する（半角）", () => {
    expect(parseWarekiYear("令和7年第4回牟岐町議会定例会")).toBe(2025);
    expect(parseWarekiYear("令和6年第1回牟岐町議会臨時会")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第１回牟岐町議会定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第１回牟岐町議会定例会")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和７年第４回牟岐町議会定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和７年第１回牟岐町議会臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseMeetingLinks", () => {
  it("一覧ページから会議詳細ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/doc/2026011400026/">令和７年第４回牟岐町議会定例会</a></li>
        <li><a href="/doc/2025080100015/">令和７年第２回牟岐町議会定例会</a></li>
        <li><a href="/doc/2024120100010/">令和６年第４回牟岐町議会定例会</a></li>
      </ul>
    `;

    const result = parseMeetingLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和７年第４回牟岐町議会定例会",
      url: "https://www.town.tokushima-mugi.lg.jp/doc/2026011400026/",
      docId: "2026011400026",
    });
    expect(result[1]).toEqual({
      title: "令和７年第２回牟岐町議会定例会",
      url: "https://www.town.tokushima-mugi.lg.jp/doc/2025080100015/",
      docId: "2025080100015",
    });
  });

  it("議会・年号を含まないリンクを除外する", () => {
    const html = `
      <a href="/doc/2026011400026/">令和７年第４回牟岐町議会定例会</a>
      <a href="/doc/1234567890123/">お知らせ</a>
      <a href="/doc/9999999999999/">議員名簿</a>
    `;

    const result = parseMeetingLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和７年第４回牟岐町議会定例会");
  });

  it("重複するdocIdを除外する", () => {
    const html = `
      <a href="/doc/2026011400026/">令和７年第４回牟岐町議会定例会</a>
      <a href="/doc/2026011400026/">令和７年第４回牟岐町議会定例会</a>
    `;

    const result = parseMeetingLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseMeetingLinks(html)).toEqual([]);
  });
});

describe("parseHeldOnFromHtml", () => {
  it("令和の全角日付を解析する", () => {
    const html = `<p>令和６年１２月１０日（火）　開会：９時３０分　　散会：１１時１８分</p>`;
    expect(parseHeldOnFromHtml(html)).toBe("2024-12-10");
  });

  it("令和の半角日付を解析する", () => {
    const html = `<p>令和7年12月9日（火）開会：9時30分</p>`;
    expect(parseHeldOnFromHtml(html)).toBe("2025-12-09");
  });

  it("令和元年を解析する", () => {
    const html = `<p>令和元年６月１０日（月）開会</p>`;
    expect(parseHeldOnFromHtml(html)).toBe("2019-06-10");
  });

  it("平成の日付を解析する", () => {
    const html = `<p>平成30年3月12日（月）開会：9時30分</p>`;
    expect(parseHeldOnFromHtml(html)).toBe("2018-03-12");
  });

  it("日付がない場合はnullを返す", () => {
    expect(parseHeldOnFromHtml("<p>会議録テスト</p>")).toBeNull();
    expect(parseHeldOnFromHtml("")).toBeNull();
  });
});

describe("extractPdfLinks", () => {
  it("PDFリンクを抽出する（新形式）", () => {
    const html = `
      <div>
        <a href="file_contents/00.pdf">町長議案説明[PDF：259KB]</a>
        <a href="file_contents/01.pdf">01 木本議員[PDF：159KB]</a>
        <a href="file_contents/02.pdf">02 小松議員[PDF：320KB]</a>
      </div>
    `;

    const result = extractPdfLinks(
      html,
      "令和６年　第４回牟岐町議会定例会",
      "2025021300067",
      "https://www.town.tokushima-mugi.lg.jp/doc/2025021300067/",
      "2024-12-10"
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和６年　第４回牟岐町議会定例会",
      pdfLabel: "町長議案説明[PDF：259KB]",
      pdfUrl: "https://www.town.tokushima-mugi.lg.jp/doc/2025021300067/file_contents/00.pdf",
      meetingType: "plenary",
      docId: "2025021300067",
      heldOn: "2024-12-10",
    });
    expect(result[1]!.pdfLabel).toBe("01 木本議員[PDF：159KB]");
    expect(result[2]!.pdfLabel).toBe("02 小松議員[PDF：320KB]");
  });

  it("旧形式のPDFファイル名でも抽出できる", () => {
    const html = `
      <a href="file_contents/2018050100029_docs_2018042600018_file_contents_horiuchi.pdf">堀内議員一般質問</a>
      <a href="file_contents/2018050100029_docs_2018042600018_file_contents_fujimoto.pdf">藤本議員一般質問</a>
    `;

    const result = extractPdfLinks(
      html,
      "平成30年第１回牟岐町議会定例会",
      "2018050100029",
      "https://www.town.tokushima-mugi.lg.jp/doc/2018050100029/",
      "2018-03-12"
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tokushima-mugi.lg.jp/doc/2018050100029/file_contents/2018050100029_docs_2018042600018_file_contents_horiuchi.pdf"
    );
    expect(result[0]!.heldOn).toBe("2018-03-12");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <a href="file_contents/00.pdf">議案説明</a>
    `;

    const result = extractPdfLinks(
      html,
      "令和７年第１回牟岐町議会臨時会",
      "2025050100005",
      "https://www.town.tokushima-mugi.lg.jp/doc/2025050100005/",
      "2025-05-07"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `<p>PDFはありません</p>`;

    const result = extractPdfLinks(
      html,
      "令和７年第４回牟岐町議会定例会",
      "2026011400026",
      "https://www.town.tokushima-mugi.lg.jp/doc/2026011400026/",
      "2025-12-09"
    );

    expect(result).toEqual([]);
  });

  it("heldOnがnullの場合も正常に抽出する", () => {
    const html = `
      <a href="file_contents/01.pdf">一般質問</a>
    `;

    const result = extractPdfLinks(
      html,
      "牟岐町議会定例会",
      "9999",
      "https://www.town.tokushima-mugi.lg.jp/doc/9999/",
      null
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBeNull();
  });
});
