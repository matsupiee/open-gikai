import { describe, expect, it } from "vitest";
import {
  detectMeetingType,
  extractHeldOnFromText,
  parseSessionYear,
  resolveUrl,
  toHalfWidth,
} from "./shared";
import {
  extractDateFromLinkText,
  extractSpeakers,
  extractTypeFromLinkText,
  parseListPage,
} from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和８年")).toBe("令和8年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("parseSessionYear", () => {
  it("令和年度から西暦年を取得する", () => {
    expect(parseSessionYear("令和7年第6回定例会（12月）")).toBe(2025);
    expect(parseSessionYear("令和6年第1回定例会（3月）")).toBe(2024);
  });

  it("令和元年に対応する", () => {
    expect(parseSessionYear("令和元年第1回定例会（3月）")).toBe(2019);
  });

  it("平成年度から西暦年を取得する", () => {
    expect(parseSessionYear("平成31年第1回定例会（3月）")).toBe(2019);
    expect(parseSessionYear("平成24年第1回定例会（3月）")).toBe(2012);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseSessionYear("議事録")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("令和7年第6回定例会（12月）")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("令和7年第1回臨時会")).toBe("extraordinary");
  });
});

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(extractHeldOnFromText("令和7年3月3日（月）午前10時開会")).toBe(
      "2025-03-03",
    );
  });

  it("令和元年に対応する", () => {
    expect(extractHeldOnFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(extractHeldOnFromText("平成30年12月10日")).toBe("2018-12-10");
  });

  it("全角数字の日付を変換する", () => {
    expect(extractHeldOnFromText("令和７年３月３日")).toBe("2025-03-03");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromText("2024年3月1日")).toBeNull();
  });
});

describe("resolveUrl", () => {
  it("プロトコル相対URLにhttps:を付与する", () => {
    expect(
      resolveUrl(
        "//www.town.yamanouchi.nagano.jp/material/files/group/38/R071129_mokuji.pdf",
      ),
    ).toBe(
      "https://www.town.yamanouchi.nagano.jp/material/files/group/38/R071129_mokuji.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl(
        "https://www.town.yamanouchi.nagano.jp/material/files/group/38/test.pdf",
      ),
    ).toBe(
      "https://www.town.yamanouchi.nagano.jp/material/files/group/38/test.pdf",
    );
  });

  it("相対パスにはBASE_ORIGINを付与する", () => {
    expect(resolveUrl("/material/files/group/38/test.pdf")).toBe(
      "https://www.town.yamanouchi.nagano.jp/material/files/group/38/test.pdf",
    );
  });
});

describe("extractDateFromLinkText", () => {
  it("日付を抽出する", () => {
    expect(extractDateFromLinkText("・11月28日 初日")).toBe("11月28日");
    expect(extractDateFromLinkText("・12月4日 一般質問")).toBe("12月4日");
  });

  it("全角数字も対応する", () => {
    expect(extractDateFromLinkText("・１１月２８日 初日")).toBe("11月28日");
  });

  it("目次のような日付なしはnullを返す", () => {
    expect(extractDateFromLinkText("・目 次")).toBeNull();
  });
});

describe("extractTypeFromLinkText", () => {
  it("初日を抽出する", () => {
    expect(extractTypeFromLinkText("・11月28日 初日")).toBe("初日");
  });

  it("最終日を抽出する", () => {
    expect(extractTypeFromLinkText("・12月8日 最終日")).toBe("最終日");
  });

  it("一般質問を抽出する", () => {
    expect(extractTypeFromLinkText("・12月4日 一般質問")).toBe("一般質問");
  });

  it("議案審議を抽出する", () => {
    expect(extractTypeFromLinkText("・12月5日 議案審議")).toBe("議案審議");
  });

  it("一般質問・議案審議を抽出する", () => {
    expect(extractTypeFromLinkText("・9月5日 一般質問・議案審議")).toBe(
      "一般質問・議案審議",
    );
  });

  it("目次を抽出する", () => {
    expect(extractTypeFromLinkText("・目 次")).toBe("目次");
  });

  it("臨時会を抽出する", () => {
    expect(extractTypeFromLinkText("・3月15日 臨時会")).toBe("臨時会");
  });
});

describe("extractSpeakers", () => {
  it("質問者リストを抽出する", () => {
    expect(
      extractSpeakers(
        "・12月4日 一般質問（1.髙田佳久　2.湯本晴彦　3.畔上恵子　4.山本光俊）",
      ),
    ).toEqual(["髙田佳久", "湯本晴彦", "畔上恵子", "山本光俊"]);
  });

  it("質問者が1人の場合も対応する", () => {
    expect(extractSpeakers("・9月5日 一般質問（1.田中太郎）")).toEqual([
      "田中太郎",
    ]);
  });

  it("括弧がない場合は空配列を返す", () => {
    expect(extractSpeakers("・11月28日 初日")).toEqual([]);
  });
});

describe("parseListPage", () => {
  it("h3見出しとwysiwygからPDFリンクを抽出する", () => {
    const html = `
      <div class="free-layout-area">
        <h2>議事録</h2>
        <h3>令和7年第6回定例会（12月）</h3>
        <div class="wysiwyg">
          <p><a target="_blank" class="icon2" href="//www.town.yamanouchi.nagano.jp/material/files/group/38/mokuji12gatu.pdf">・目 次</a></p>
          <p><a target="_blank" class="icon2" href="//www.town.yamanouchi.nagano.jp/material/files/group/38/syonoti28.pdf">・11月28日 初日</a></p>
          <p><a target="_blank" class="icon2" href="//www.town.yamanouchi.nagano.jp/material/files/group/38/ittupannsitumonn1.pdf">・12月4日 一般質問</a>（1.髙田佳久　2.湯本晴彦　3.畔上恵子）</p>
        </div>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      sessionName: "令和7年第6回定例会（12月）",
      date: "",
      type: "目次",
      speakers: [],
      pdfUrl:
        "https://www.town.yamanouchi.nagano.jp/material/files/group/38/mokuji12gatu.pdf",
      meetingType: "plenary",
      year: 2025,
    });
    expect(result[1]).toEqual({
      sessionName: "令和7年第6回定例会（12月）",
      date: "11月28日",
      type: "初日",
      speakers: [],
      pdfUrl:
        "https://www.town.yamanouchi.nagano.jp/material/files/group/38/syonoti28.pdf",
      meetingType: "plenary",
      year: 2025,
    });
    expect(result[2]!.type).toBe("一般質問");
    expect(result[2]!.speakers).toEqual(["髙田佳久", "湯本晴彦", "畔上恵子"]);
    expect(result[2]!.year).toBe(2025);
  });

  it("臨時会の会議種別はextraordinaryになる", () => {
    const html = `
      <div class="free-layout-area">
        <h3>令和7年第1回臨時会</h3>
        <div class="wysiwyg">
          <p><a href="//www.town.yamanouchi.nagano.jp/material/files/group/38/rinji1.pdf">・3月15日 臨時会</a></p>
        </div>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.type).toBe("臨時会");
    expect(result[0]!.year).toBe(2025);
  });

  it("複数の定例会から正しく収集する", () => {
    const html = `
      <div class="free-layout-area">
        <h3>令和7年第6回定例会（12月）</h3>
        <div class="wysiwyg">
          <p><a href="//host/r7_6_syonoti.pdf">・11月28日 初日</a></p>
        </div>
        <h3>令和7年第5回定例会（9月）</h3>
        <div class="wysiwyg">
          <p><a href="//host/r7_5_syonoti.pdf">・8月29日 初日</a></p>
          <p><a href="//host/r7_5_saishuu.pdf">・9月9日 最終日</a></p>
        </div>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.sessionName).toBe("令和7年第6回定例会（12月）");
    expect(result[0]!.type).toBe("初日");
    expect(result[1]!.sessionName).toBe("令和7年第5回定例会（9月）");
    expect(result[1]!.type).toBe("初日");
    expect(result[2]!.type).toBe("最終日");
  });

  it("平成年度の定例会も正しく収集する", () => {
    const html = `
      <div class="free-layout-area">
        <h3>平成24年第1回定例会</h3>
        <div class="wysiwyg">
          <p><a href="//host/gijiroku_24_1.pdf">・3月1日 初日</a></p>
        </div>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2012);
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("令和元年の定例会も正しく収集する", () => {
    const html = `
      <div class="free-layout-area">
        <h3>令和元年第3回定例会（9月）</h3>
        <div class="wysiwyg">
          <p><a href="//host/R010903.pdf">・9月3日 初日</a></p>
        </div>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2019);
  });

  it("一般質問・議案審議の複合種別も対応する", () => {
    const html = `
      <div class="free-layout-area">
        <h3>令和6年第4回定例会（9月）</h3>
        <div class="wysiwyg">
          <p><a href="//host/R060905_situmon.pdf">・9月5日 一般質問・議案審議</a>（1.田中太郎　2.鈴木花子）</p>
        </div>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("一般質問・議案審議");
    expect(result[0]!.speakers).toEqual(["田中太郎", "鈴木花子"]);
  });
});
