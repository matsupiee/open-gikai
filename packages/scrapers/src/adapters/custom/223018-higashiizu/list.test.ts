import { describe, it, expect } from "vitest";
import { parseJapaneseDate, parseMetaFromLinkText, parseListPage } from "./list";

describe("parseJapaneseDate", () => {
  it("令和の日付を変換する", () => {
    expect(parseJapaneseDate("令和7年12月3日")).toBe("2025-12-03");
  });

  it("令和元年を変換する", () => {
    expect(parseJapaneseDate("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(parseJapaneseDate("平成31年3月15日")).toBe("2019-03-15");
  });

  it("月日を0埋めする", () => {
    expect(parseJapaneseDate("令和6年3月1日")).toBe("2024-03-01");
  });

  it("不正なテキストは null を返す", () => {
    expect(parseJapaneseDate("2025年12月3日")).toBeNull();
  });
});

describe("parseMetaFromLinkText", () => {
  it("本会議の定例会リンクテキストをパースする", () => {
    const result = parseMetaFromLinkText(
      "令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2025-12-03");
    expect(result!.section).toBe("第4回定例会");
    expect(result!.title).toBe("令和7年第4回定例会");
  });

  it("臨時会のリンクテキストをパースする", () => {
    const result = parseMetaFromLinkText(
      "令和6年5月20日 第1回臨時会 (PDFファイル: 0.5MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-05-20");
    expect(result!.section).toBe("第1回臨時会");
    expect(result!.title).toBe("令和6年第1回臨時会");
  });

  it("委員会のリンクテキストをパースする（カテゴリ指定なし）", () => {
    const result = parseMetaFromLinkText(
      "令和7年6月10日 総務経済常任委員会 (PDFファイル: 0.8MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2025-06-10");
    expect(result!.section).toBe("総務経済常任委員会");
  });

  it("会議名がなくカテゴリが指定されている場合はカテゴリを使う", () => {
    const result = parseMetaFromLinkText(
      "令和7年6月10日 (PDFファイル: 0.3MB)",
      "決算審査特別委員会"
    );

    expect(result).not.toBeNull();
    expect(result!.section).toBe("決算審査特別委員会");
  });

  it("令和元年を正しくパースする", () => {
    const result = parseMetaFromLinkText(
      "令和元年9月5日 第3回定例会 (PDFファイル: 1.0MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2019-09-05");
  });

  it("不正なテキストは null を返す", () => {
    expect(parseMetaFromLinkText("資料一覧")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("本会議一覧ページから PDF リンクを抽出する", () => {
    const html = `
      <h2>令和7年（2025年）本会議</h2>
      <a href="//www.town.higashiizu.lg.jp/material/files/group/13/r7_teirei4.pdf">
        令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)
      </a>
      <a href="//www.town.higashiizu.lg.jp/material/files/group/13/r7_teirei3.pdf">
        令和7年9月10日 第3回定例会 (PDFファイル: 1.5MB)
      </a>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("令和7年第4回定例会");
    expect(meetings[0]!.section).toBe("第4回定例会");
    expect(meetings[0]!.heldOn).toBe("2025-12-03");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.higashiizu.lg.jp/material/files/group/13/r7_teirei4.pdf"
    );

    expect(meetings[1]!.title).toBe("令和7年第3回定例会");
    expect(meetings[1]!.heldOn).toBe("2025-09-10");
  });

  it("年度でフィルタリングする", () => {
    const html = `
      <h2>令和7年（2025年）本会議</h2>
      <a href="/material/files/group/13/r7.pdf">
        令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)
      </a>
      <h2>令和6年（2024年）本会議</h2>
      <a href="/material/files/group/13/r6.pdf">
        令和6年12月5日 第4回定例会 (PDFファイル: 1.0MB)
      </a>
    `;

    const meetings2025 = parseListPage(html, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-12-03");

    const meetings2024 = parseListPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-05");
  });

  it("委員会ページから h3 カテゴリ付きで抽出する", () => {
    const html = `
      <h2>令和7年（2025年）</h2>
      <h3>総務経済常任委員会</h3>
      <a href="/material/files/group/13/soumu_r7.pdf">
        令和7年6月10日 総務経済常任委員会 (PDFファイル: 0.8MB)
      </a>
      <h3>文教厚生常任委員会</h3>
      <a href="/material/files/group/13/bunkyo_r7.pdf">
        令和7年6月11日 文教厚生常任委員会 (PDFファイル: 0.7MB)
      </a>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.section).toBe("総務経済常任委員会");
    expect(meetings[1]!.section).toBe("文教厚生常任委員会");
  });

  it("プロトコル相対 URL を https に変換する", () => {
    const html = `
      <h2>令和7年（2025年）本会議</h2>
      <a href="//www.town.higashiizu.lg.jp/material/files/group/13/test.pdf">
        令和7年3月1日 第1回定例会 (PDFファイル: 1.0MB)
      </a>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.higashiizu.lg.jp/material/files/group/13/test.pdf"
    );
  });

  it("メタ情報を抽出できないリンクはスキップする", () => {
    const html = `
      <h2>令和7年（2025年）本会議</h2>
      <a href="/material/files/group/13/valid.pdf">
        令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)
      </a>
      <a href="/material/files/group/13/invalid.pdf">
        議事日程一覧 (PDFファイル: 0.2MB)
      </a>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(1);
  });
});
