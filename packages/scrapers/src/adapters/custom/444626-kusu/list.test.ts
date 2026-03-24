import { describe, expect, it } from "vitest";
import {
  parseDetailPageLink,
  parseSectionHeading,
  extractDateFromLinkText,
  parsePdfLinksFromDetail,
} from "./list";

describe("parseDetailPageLink", () => {
  it("議事録詳細ページへのリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <a href="/soshiki/gikaijimukyoku/1/1/1/reiwa3nenkaigiroku_2/5320.html">玖珠町議会 議事録 令和6年</a>
      </body>
      </html>
    `;

    const result = parseDetailPageLink(html);
    expect(result).toBe(
      "https://www.town.kusu.oita.jp/soshiki/gikaijimukyoku/1/1/1/reiwa3nenkaigiroku_2/5320.html",
    );
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <a href="https://www.town.kusu.oita.jp/soshiki/gikaijimukyoku/1/1/1/reiwa4nenkaigiroku/4526.html">令和4年</a>
    `;

    const result = parseDetailPageLink(html);
    expect(result).toBe(
      "https://www.town.kusu.oita.jp/soshiki/gikaijimukyoku/1/1/1/reiwa4nenkaigiroku/4526.html",
    );
  });

  it("議事録詳細ページへのリンクがない場合は null を返す", () => {
    const html = `
      <a href="/choseijoho/kusuchogikai/1/index.html">一覧に戻る</a>
    `;

    const result = parseDetailPageLink(html);
    expect(result).toBeNull();
  });
});

describe("parseSectionHeading", () => {
  it("定例会のセクションヘッダーを解析する", () => {
    const result = parseSectionHeading(
      "令和6年第4回定例会（令和6年11月29日～12月17日）",
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.meetingType).toBe("plenary");
    expect(result!.month).toBe(11);
  });

  it("臨時会のセクションヘッダーを解析する", () => {
    const result = parseSectionHeading("令和6年第1回臨時会（令和6年1月25日）");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.month).toBe(1);
  });

  it("令和元年を正しく解析する", () => {
    const result = parseSectionHeading(
      "令和元年第1回定例会（令和元年3月1日～3月19日）",
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.meetingType).toBe("plenary");
  });

  it("平成の年号を正しく解析する", () => {
    const result = parseSectionHeading(
      "平成30年第1回定例会（平成30年3月1日～3月19日）",
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2018);
  });

  it("令和5年を正しく解析する", () => {
    const result = parseSectionHeading(
      "令和5年第4回定例会（令和5年12月4日～12月19日）",
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.month).toBe(12);
  });

  it("年号がない場合は null を返す", () => {
    const result = parseSectionHeading("第4回定例会（11月29日）");
    expect(result).toBeNull();
  });
});

describe("extractDateFromLinkText", () => {
  it("括弧内の日付を抽出する", () => {
    expect(extractDateFromLinkText("開会（11月29日）", 2024)).toBe(
      "2024-11-29",
    );
  });

  it("12月の日付を正しく抽出する", () => {
    expect(extractDateFromLinkText("一般質問（12月5日）", 2024)).toBe(
      "2024-12-05",
    );
  });

  it("臨時会の開閉会日付を抽出する", () => {
    expect(extractDateFromLinkText("開閉会（1月25日）", 2024)).toBe(
      "2024-01-25",
    );
  });

  it("括弧がない場合は null を返す（一般質問表）", () => {
    expect(extractDateFromLinkText("一般質問表", 2024)).toBeNull();
  });

  it("月が一桁でも正しくゼロパディングする", () => {
    expect(extractDateFromLinkText("開会（3月1日）", 2023)).toBe(
      "2023-03-01",
    );
  });
});

describe("parsePdfLinksFromDetail", () => {
  it("h3 セクションヘッダーと PDF リンクを解析する", () => {
    const html = `
      <div>
        <h3>令和6年第4回定例会（令和6年11月29日～12月17日）</h3>
        <ul>
          <li><a href="//www.town.kusu.oita.jp/material/files/group/18/612kaikaibi.pdf">開会（11月29日）(PDFファイル: 272.3KB)</a></li>
          <li><a href="//www.town.kusu.oita.jp/material/files/group/18/612giannsitugi.pdf">議案質疑（12月3日）(PDFファイル: 207.2KB)</a></li>
          <li><a href="//www.town.kusu.oita.jp/material/files/group/18/612ippannsitumonnhyou.pdf">一般質問表(PDFファイル: 150.0KB)</a></li>
          <li><a href="//www.town.kusu.oita.jp/material/files/group/18/612ippannsitumonn1.pdf">一般質問（12月5日）(PDFファイル: 300.0KB)</a></li>
          <li><a href="//www.town.kusu.oita.jp/material/files/group/18/612heikaibi.pdf">閉会（12月17日）(PDFファイル: 180.0KB)</a></li>
        </ul>
        <h3>令和6年第2回臨時会（令和6年10月29日）</h3>
        <ul>
          <li><a href="//www.town.kusu.oita.jp/material/files/group/18/R610rinnjikai.pdf">開閉会（10月29日）(PDFファイル: 100.0KB)</a></li>
        </ul>
      </div>
    `;

    const detailPageUrl =
      "https://www.town.kusu.oita.jp/soshiki/gikaijimukyoku/1/1/1/reiwa3nenkaigiroku_2/5320.html";
    const result = parsePdfLinksFromDetail(html, detailPageUrl);

    expect(result).toHaveLength(6);

    // 定例会の開会
    expect(result[0]!.title).toContain("令和6年第4回定例会");
    expect(result[0]!.title).toContain("開会（11月29日）");
    expect(result[0]!.heldOn).toBe("2024-11-29");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kusu.oita.jp/material/files/group/18/612kaikaibi.pdf",
    );

    // 議案質疑（12月）
    expect(result[1]!.heldOn).toBe("2024-12-03");

    // 一般質問表（日付なし）
    expect(result[2]!.heldOn).toBeNull();

    // 一般質問（12月5日）
    expect(result[3]!.heldOn).toBe("2024-12-05");

    // 臨時会
    expect(result[5]!.meetingType).toBe("extraordinary");
    expect(result[5]!.heldOn).toBe("2024-10-29");
    expect(result[5]!.detailPageUrl).toBe(detailPageUrl);
  });

  it("h3 セクションヘッダーがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    const result = parsePdfLinksFromDetail(html, "https://example.com");
    expect(result).toEqual([]);
  });

  it("PDF リンクがない h3 セクションは無視する", () => {
    const html = `
      <h3>令和6年第4回定例会（令和6年11月29日～12月17日）</h3>
      <p>準備中です。</p>
    `;
    const result = parsePdfLinksFromDetail(html, "https://example.com");
    expect(result).toEqual([]);
  });

  it("// 始まりの URL を https: に変換する", () => {
    const html = `
      <h3>令和6年第4回定例会（令和6年11月29日～12月17日）</h3>
      <a href="//www.town.kusu.oita.jp/material/files/group/18/test.pdf">開会（11月29日）</a>
    `;
    const result = parsePdfLinksFromDetail(html, "https://example.com");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kusu.oita.jp/material/files/group/18/test.pdf",
    );
  });

  it("令和5年の PDF リンクを正しく解析する", () => {
    const html = `
      <h3>令和5年第4回定例会（令和5年12月4日～12月19日）</h3>
      <ul>
        <li><a href="//www.town.kusu.oita.jp/material/files/group/18/R541kaikaibi.pdf">開会（12月4日）</a></li>
        <li><a href="//www.town.kusu.oita.jp/material/files/group/18/R542giannsitugi.pdf">議案質疑（12月6日）</a></li>
      </ul>
    `;
    const result = parsePdfLinksFromDetail(html, "https://example.com");
    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2023-12-04");
    expect(result[1]!.heldOn).toBe("2023-12-06");
  });
});
