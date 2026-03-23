import { describe, expect, it } from "vitest";
import {
  detectMeetingType,
  extractDateFromLinkText,
  toHalfWidth,
} from "./shared";
import {
  extractSessionTitle,
  normalizeLinkText,
  parseIppanShitsumonPage,
  parseYearPage,
  resolveUrl,
} from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("extractDateFromLinkText", () => {
  it("令和の日付を変換する", () => {
    expect(extractDateFromLinkText("本会議（令和6年11月26日）")).toBe(
      "2024-11-26",
    );
  });

  it("全角数字の令和日付を変換する", () => {
    expect(extractDateFromLinkText("本会議（令和７年３月５日）")).toBe(
      "2025-03-05",
    );
  });

  it("令和元年に対応する", () => {
    expect(extractDateFromLinkText("本会議（令和元年6月10日）")).toBe(
      "2019-06-10",
    );
  });

  it("平成の日付を変換する", () => {
    expect(
      extractDateFromLinkText("1日目（平成29年11月27日）[PDFファイル／631KB]"),
    ).toBe("2017-11-27");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractDateFromLinkText("会議録 [PDFファイル／317KB]")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("本会議をplenaryと判定する", () => {
    expect(detectMeetingType("本会議（令和6年11月26日）")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("臨時会（令和7年1月16日）")).toBe("extraordinary");
  });

  it("総務常任委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("総務常任委員会（令和6年12月9日）")).toBe(
      "committee",
    );
  });

  it("予算特別委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("予算特別委員会（令和7年3月11日）")).toBe(
      "committee",
    );
  });

  it("連合審査会をcommitteeと判定する", () => {
    expect(detectMeetingType("連合審査会（令和7年3月10日）")).toBe("committee");
  });
});

describe("normalizeLinkText", () => {
  it("[PDFファイル/...]を除去する", () => {
    expect(
      normalizeLinkText("本会議（令和6年11月26日） [PDFファイル／483KB]"),
    ).toBe("本会議（令和6年11月26日）");
  });

  it("全角数字を半角に変換する", () => {
    expect(normalizeLinkText("第１回定例会")).toBe("第1回定例会");
  });

  it("余分な空白を除去する", () => {
    expect(normalizeLinkText("  本会議  ")).toBe("本会議");
  });
});

describe("resolveUrl", () => {
  it("相対パスを絶対URLに変換する", () => {
    expect(resolveUrl("/uploaded/attachment/28773.pdf")).toBe(
      "https://www.city.hida.gifu.jp/uploaded/attachment/28773.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl(
        "https://www.city.hida.gifu.jp/uploaded/attachment/28773.pdf",
      ),
    ).toBe("https://www.city.hida.gifu.jp/uploaded/attachment/28773.pdf");
  });
});

describe("extractSessionTitle", () => {
  it("定例会の見出しからセッションタイトルを抽出する", () => {
    expect(extractSessionTitle("第4回定例会（11月26日～12月12日）")).toBe(
      "第4回定例会",
    );
  });

  it("臨時会の見出しからセッションタイトルを抽出する", () => {
    expect(extractSessionTitle("第1回臨時会（1月16日）")).toBe("第1回臨時会");
  });

  it("全角数字を半角に変換する", () => {
    expect(extractSessionTitle("第４回定例会（１１月）")).toBe("第4回定例会");
  });
});

describe("parseYearPage", () => {
  it("h3見出しとPDFリンクを正しく紐付ける", () => {
    const html = `
      <h3>第4回定例会（11月26日～12月12日）</h3>
      <ul>
        <li><a href="/uploaded/attachment/28773.pdf">本会議（令和6年11月26日） [PDFファイル／483KB]</a></li>
        <li><a href="/uploaded/attachment/28769.pdf">本会議（令和6年12月4日） [PDFファイル／500KB]</a></li>
      </ul>
    `;

    const { pdfLinks } = parseYearPage(html);

    expect(pdfLinks).toHaveLength(2);
    expect(pdfLinks[0]).toEqual({
      title: "本会議（令和6年11月26日）",
      pdfUrl:
        "https://www.city.hida.gifu.jp/uploaded/attachment/28773.pdf",
      meetingType: "plenary",
      heldOn: "2024-11-26",
      speakerName: null,
      sessionTitle: "第4回定例会",
    });
    expect(pdfLinks[1]!.heldOn).toBe("2024-12-04");
  });

  it("委員会をcommitteeとして分類する", () => {
    const html = `
      <h3>第2回定例会（2月25日～3月18日）</h3>
      <ul>
        <li><a href="/uploaded/attachment/31189.pdf">総務常任委員会（令和7年3月10日） [PDFファイル／200KB]</a></li>
        <li><a href="/uploaded/attachment/31174.pdf">連合審査会（令和7年3月10日） [PDFファイル／150KB]</a></li>
      </ul>
    `;

    const { pdfLinks } = parseYearPage(html);

    expect(pdfLinks).toHaveLength(2);
    expect(pdfLinks[0]!.meetingType).toBe("committee");
    expect(pdfLinks[1]!.meetingType).toBe("committee");
  });

  it("臨時会をextraordinaryとして分類する", () => {
    const html = `
      <h3>第1回臨時会（1月16日）</h3>
      <ul>
        <li><a href="/uploaded/attachment/30022.pdf">臨時会（令和7年1月16日） [PDFファイル／300KB]</a></li>
      </ul>
    `;

    const { pdfLinks } = parseYearPage(html);

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.meetingType).toBe("extraordinary");
    expect(pdfLinks[0]!.sessionTitle).toBe("第1回臨時会");
  });

  it("一般質問個人別ページのリンクを収集する", () => {
    const html = `
      <h3>第4回定例会（11月26日～12月12日）</h3>
      <ul>
        <li><a href="/uploaded/attachment/28773.pdf">本会議（令和6年11月26日） [PDFファイル／483KB]</a></li>
      </ul>
      <p><a href="/site/gikai/68579.html">個人ごとの一般質問はこちら</a></p>
    `;

    const { ippanShitsumonUrls } = parseYearPage(html);

    expect(ippanShitsumonUrls).toHaveLength(1);
    expect(ippanShitsumonUrls[0]!.url).toBe(
      "https://www.city.hida.gifu.jp/site/gikai/68579.html",
    );
    expect(ippanShitsumonUrls[0]!.sessionTitle).toBe("第4回定例会");
  });

  it("複数の定例会/臨時会を正しく紐付ける", () => {
    const html = `
      <h3>第4回定例会（11月26日～12月12日）</h3>
      <ul>
        <li><a href="/uploaded/attachment/28773.pdf">本会議（令和6年11月26日） [PDFファイル／483KB]</a></li>
      </ul>
      <h3>第1回臨時会（1月16日）</h3>
      <ul>
        <li><a href="/uploaded/attachment/30022.pdf">臨時会（令和7年1月16日） [PDFファイル／300KB]</a></li>
      </ul>
    `;

    const { pdfLinks } = parseYearPage(html);

    expect(pdfLinks).toHaveLength(2);
    expect(pdfLinks[0]!.sessionTitle).toBe("第4回定例会");
    expect(pdfLinks[1]!.sessionTitle).toBe("第1回臨時会");
  });

  it("h2見出し（古い年度ページ）にも対応する", () => {
    const html = `
      <h2>第4回定例会（12月）</h2>
      <ul>
        <li><a href="/uploaded/attachment/3118.pdf">1日目（平成29年11月27日）[PDFファイル／631KB]</a></li>
      </ul>
    `;

    const { pdfLinks } = parseYearPage(html);

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.heldOn).toBe("2017-11-27");
    expect(pdfLinks[0]!.sessionTitle).toBe("第4回定例会");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    const { pdfLinks } = parseYearPage(html);
    expect(pdfLinks).toEqual([]);
  });
});

describe("parseIppanShitsumonPage", () => {
  it("テーブルから発言者名とPDFリンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>番号</td>
          <td>発言者</td>
          <td>質問事項・会議録</td>
          <td>YouTube動画・発言日</td>
        </tr>
        <tr>
          <td>1</td>
          <td>佐藤　克成</td>
          <td><a href="/uploaded/attachment/28548.pdf">会議録 [PDFファイル／317KB]</a></td>
          <td>令和6年12月4日</td>
        </tr>
        <tr>
          <td>2</td>
          <td>中根　洋一</td>
          <td><a href="/uploaded/attachment/28549.pdf">会議録 [PDFファイル／250KB]</a></td>
          <td>令和6年12月4日</td>
        </tr>
      </table>
    `;

    const result = parseIppanShitsumonPage(html, "第4回定例会");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "一般質問（佐藤克成）",
      pdfUrl:
        "https://www.city.hida.gifu.jp/uploaded/attachment/28548.pdf",
      meetingType: "plenary",
      heldOn: "2024-12-04",
      speakerName: "佐藤克成",
      sessionTitle: "第4回定例会",
    });
    expect(result[1]!.speakerName).toBe("中根洋一");
    expect(result[1]!.heldOn).toBe("2024-12-04");
  });

  it("ヘッダー行をスキップする", () => {
    const html = `
      <table>
        <tr>
          <td>番号</td>
          <td>発言者</td>
          <td>質問事項・会議録</td>
          <td>YouTube動画・発言日</td>
        </tr>
      </table>
    `;

    const result = parseIppanShitsumonPage(html, "第4回定例会");
    expect(result).toEqual([]);
  });

  it("PDFリンクがない行をスキップする", () => {
    const html = `
      <table>
        <tr>
          <td>1</td>
          <td>佐藤　克成</td>
          <td>準備中</td>
          <td>令和6年12月4日</td>
        </tr>
      </table>
    `;

    const result = parseIppanShitsumonPage(html, "第4回定例会");
    expect(result).toEqual([]);
  });
});
