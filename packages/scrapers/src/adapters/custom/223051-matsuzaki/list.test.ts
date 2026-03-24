import { describe, expect, it } from "vitest";
import {
  parseDocIds,
  extractPdfLinks,
  parseDetailPage,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年松崎町議会会議録")).toBe(2024);
    expect(parseWarekiYear("令和4年松崎町議会会議録")).toBe(2022);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年松崎町議会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成29年松崎町議会第1回定例会議事録")).toBe(2017);
    expect(parseWarekiYear("平成24年松崎町議会会議録")).toBe(2012);
  });

  it("平成元年を変換する", () => {
    expect(parseWarekiYear("平成元年会議録")).toBe(1989);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
    expect(detectMeetingType("令和6年 第２回定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
    expect(detectMeetingType("令和6年 第２回臨時会")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseDocIds", () => {
  it("一覧ページから会議録詳細ページのIDを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/docs/5619/">令和６年松崎町議会会議録</a></li>
        <li><a href="/docs/4800/">令和5年松崎町議会会議録</a></li>
        <li><a href="/docs/3500/">令和4年松崎町議会会議録</a></li>
      </ul>
    `;

    const result = parseDocIds(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ docId: "5619", title: "令和６年松崎町議会会議録" });
    expect(result[1]).toEqual({ docId: "4800", title: "令和5年松崎町議会会議録" });
    expect(result[2]).toEqual({ docId: "3500", title: "令和4年松崎町議会会議録" });
  });

  it("会議録・議事録以外のリンクを除外する", () => {
    const html = `
      <a href="/docs/5619/">令和６年松崎町議会会議録</a>
      <a href="/docs/9999/">お知らせ</a>
      <a href="/docs/8888/">議員名簿</a>
    `;

    const result = parseDocIds(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.docId).toBe("5619");
  });

  it("議事録もマッチする", () => {
    const html = `
      <a href="/docs/1234/">平成29年松崎町議会第1回定例会議事録</a>
    `;

    const result = parseDocIds(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.docId).toBe("1234");
  });

  it("重複する docId を除外する", () => {
    const html = `
      <a href="/docs/5619/">令和６年松崎町議会会議録</a>
      <a href="/docs/5619/">令和６年松崎町議会会議録</a>
    `;

    const result = parseDocIds(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links</p>";
    expect(parseDocIds(html)).toEqual([]);
  });
});

describe("extractPdfLinks", () => {
  it("絶対パスの PDF リンクを抽出する", () => {
    const html = `
      <a href="/docs/5619/file_contents/20240119r01kaigiroku.pdf">第１回臨時会（2024年1月19日）</a>
      <a href="/docs/5619/file_contents/r06031kaigiroku.pdf">第１回定例会（2024年3月6日〜13日）</a>
    `;

    const result = extractPdfLinks(html, "5619");

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.matsuzaki.shizuoka.jp/docs/5619/file_contents/20240119r01kaigiroku.pdf"
    );
    expect(result[0]!.linkText).toBe("第１回臨時会（2024年1月19日）");
  });

  it("相対パスの PDF リンクも抽出する", () => {
    const html = `
      <a href="file_contents/h29t1kaigiroku.pdf">h29t1kaigiroku.pdf</a>
    `;

    const result = extractPdfLinks(html, "1234");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.matsuzaki.shizuoka.jp/docs/1234/file_contents/h29t1kaigiroku.pdf"
    );
  });

  it("日本語ファイル名の PDF リンクを抽出する", () => {
    const html = `
      <a href="/docs/5619/file_contents/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E7%AC%AC2%E5%9B%9E%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">令和6年第2回定例会</a>
    `;

    const result = extractPdfLinks(html, "5619");
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>No PDF links</p>";
    expect(extractPdfLinks(html, "5619")).toEqual([]);
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <a href="/docs/5619/file_contents/test.pdf">リンク1</a>
      <a href="/docs/5619/file_contents/test.pdf">リンク2</a>
    `;

    const result = extractPdfLinks(html, "5619");
    expect(result).toHaveLength(1);
  });
});

describe("parseDetailPage", () => {
  it("年度まとめ型ページから複数セッションを抽出する", () => {
    const html = `
      <h2 class="article-body-title">令和６年松崎町議会会議録</h2>
      <ul>
        <li><a href="/docs/5619/file_contents/20240119r01kaigiroku.pdf">第１回臨時会（2024年1月19日）</a></li>
        <li><a href="/docs/5619/file_contents/r06031kaigiroku.pdf">第１回定例会（2024年3月6日〜13日）</a></li>
        <li><a href="/docs/5619/file_contents/20240329r02kaigiroku.pdf">第２回臨時会（2024年3月29日）</a></li>
      </ul>
    `;

    const result = parseDetailPage(html, "5619", "令和６年松崎町議会会議録");

    expect(result).toHaveLength(3);
    expect(result[0]!.heldOn).toBe("2024-01-19");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[1]!.heldOn).toBe("2024-03-06");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[2]!.heldOn).toBe("2024-03-29");
    expect(result[2]!.meetingType).toBe("extraordinary");
  });

  it("PDF がない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    const result = parseDetailPage(html, "5619", "令和６年松崎町議会会議録");
    expect(result).toEqual([]);
  });

  it("和暦の日付を正しく解析する", () => {
    const html = `
      <a href="/docs/5619/file_contents/pdf.pdf">第２回定例会（令和6年6月4日〜6日）</a>
    `;

    const result = parseDetailPage(html, "5619", "令和６年松崎町議会会議録");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-06-04");
    expect(result[0]!.meetingType).toBe("plenary");
  });
});
