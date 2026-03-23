import { describe, expect, it } from "vitest";
import { parseLinkText, parseListPage, parseYearPageUrls } from "./list";
import {
  toHalfWidth,
  convertWarekiDateToISO,
  detectMeetingType,
  resolveHref,
} from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年３月１１日")).toBe("令和6年3月11日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });

  it("全角半角が混在する文字列を処理する", () => {
    expect(toHalfWidth("第１回定例会2日目")).toBe("第1回定例会2日目");
  });
});

describe("convertWarekiDateToISO", () => {
  it("令和の日付を変換する", () => {
    expect(convertWarekiDateToISO("令和6年3月11日")).toBe("2024-03-11");
  });

  it("令和元年に対応する", () => {
    expect(convertWarekiDateToISO("令和元年6月20日")).toBe("2019-06-20");
  });

  it("令和7年に対応する", () => {
    expect(convertWarekiDateToISO("令和7年3月11日")).toBe("2025-03-11");
  });

  it("平成の日付を変換する", () => {
    expect(convertWarekiDateToISO("平成31年3月11日")).toBe("2019-03-11");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiDateToISO("2024年3月1日")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("臨時会")).toBe("extraordinary");
  });

  it("デフォルトはplenaryを返す", () => {
    expect(detectMeetingType("本会議")).toBe("plenary");
  });
});

describe("resolveHref", () => {
  it("/../../coupl/...形式を絶対URLに変換する", () => {
    expect(resolveHref("/../../coupl/2025/09/g_giroku_r7.3.11.pdf")).toBe(
      "http://www.town.hokuryu.hokkaido.jp/coupl/2025/09/g_giroku_r7.3.11.pdf"
    );
  });

  it("/coupl/...形式を絶対URLに変換する", () => {
    expect(resolveHref("/coupl/2024/05/g_giroku_r6.1.19.pdf")).toBe(
      "http://www.town.hokuryu.hokkaido.jp/coupl/2024/05/g_giroku_r6.1.19.pdf"
    );
  });

  it("既に絶対URLの場合はそのまま返す", () => {
    expect(
      resolveHref(
        "http://www.town.hokuryu.hokkaido.jp/coupl/2024/05/g_giroku_r6.1.19.pdf"
      )
    ).toBe(
      "http://www.town.hokuryu.hokkaido.jp/coupl/2024/05/g_giroku_r6.1.19.pdf"
    );
  });
});

describe("parseLinkText", () => {
  it("定例会（複数日）のリンクテキストをパースする", () => {
    const result = parseLinkText("第1回［令和7年3月11日］（1日目）", "定例会");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会（1日目）");
    expect(result!.heldOn).toBe("2025-03-11");
    expect(result!.meetingType).toBe("plenary");
  });

  it("定例会（2日目）のリンクテキストをパースする", () => {
    const result = parseLinkText("第1回［令和7年3月12日］（2日目）", "定例会");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会（2日目）");
    expect(result!.heldOn).toBe("2025-03-12");
    expect(result!.meetingType).toBe("plenary");
  });

  it("臨時会（日目なし）のリンクテキストをパースする", () => {
    const result = parseLinkText("第1回［令和6年1月19日］", "臨時会");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回臨時会");
    expect(result!.heldOn).toBe("2024-01-19");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("令和6年の定例会をパースする", () => {
    const result = parseLinkText("第3回［令和6年9月10日］（1日目）", "定例会");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第3回定例会（1日目）");
    expect(result!.heldOn).toBe("2024-09-10");
    expect(result!.meetingType).toBe("plenary");
  });

  it("マッチしないテキストはnullを返す", () => {
    expect(parseLinkText("議事日程", "定例会")).toBeNull();
    expect(parseLinkText("一般質問", "定例会")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("entry-content 内の定例会・臨時会 PDF リンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <p>
          <strong>■定例会</strong><br>
          <i class="fas fa-file-pdf"></i>
          <a href="/../../coupl/2025/09/g_giroku_r7.3.11.pdf">第1回［令和7年3月11日］（1日目）</a><br>
          <i class="fas fa-file-pdf"></i>
          <a href="/../../coupl/2025/09/g_giroku_r7.3.12.pdf">第1回［令和7年3月12日］（2日目）</a><br>
        </p>
        <p>
          <strong>■臨時会</strong><br>
          <i class="fas fa-file-pdf"></i>
          <a href="/../../coupl/2024/05/g_giroku_r6.1.19.pdf">第1回［令和6年1月19日］</a><br>
        </p>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("第1回定例会（1日目）");
    expect(result[0]!.heldOn).toBe("2025-03-11");
    expect(result[0]!.pdfUrl).toBe(
      "http://www.town.hokuryu.hokkaido.jp/coupl/2025/09/g_giroku_r7.3.11.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");

    expect(result[1]!.title).toBe("第1回定例会（2日目）");
    expect(result[1]!.heldOn).toBe("2025-03-12");

    expect(result[2]!.title).toBe("第1回臨時会");
    expect(result[2]!.heldOn).toBe("2024-01-19");
    expect(result[2]!.meetingType).toBe("extraordinary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <div class="entry-content">
        <p>会議録はありません</p>
      </div>
    `;
    expect(parseListPage(html)).toEqual([]);
  });

  it("パースできないリンクテキストは除外する", () => {
    const html = `
      <div class="entry-content">
        <p>
          <strong>■定例会</strong><br>
          <a href="/file/unknown.pdf">不明なファイル名.pdf</a><br>
          <a href="/../../coupl/2024/05/g_giroku_r6.3.11.pdf">第1回［令和6年3月11日］（1日目）</a><br>
        </p>
      </div>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例会（1日目）");
  });
});

describe("parseYearPageUrls", () => {
  it("トップページから過去年度ページのURLを取得する", () => {
    const html = `
      <div class="wp-block-cocoon-blocks-button-1 button-block">
        <a href="/../../gikaikaigiroku_r6" class="btn btn-l">令和6年北竜町議会会議録</a>
      </div>
      <div class="wp-block-cocoon-blocks-button-1 button-block">
        <a href="/../../gikaikaigiroku_r5" class="btn btn-l">令和5年北竜町議会会議録</a>
      </div>
    `;

    const result = parseYearPageUrls(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(
      "http://www.town.hokuryu.hokkaido.jp/../../gikaikaigiroku_r6"
    );
    expect(result[1]).toBe(
      "http://www.town.hokuryu.hokkaido.jp/../../gikaikaigiroku_r5"
    );
  });

  it("gikaikaigiroku を含まないリンクは除外する", () => {
    const html = `
      <div class="wp-block-cocoon-blocks-button-1 button-block">
        <a href="/other-page">その他のページ</a>
      </div>
      <div class="wp-block-cocoon-blocks-button-1 button-block">
        <a href="/gikaikaigiroku_r6">令和6年会議録</a>
      </div>
    `;

    const result = parseYearPageUrls(html);
    expect(result).toHaveLength(1);
  });

  it("ボタンブロックがない場合は空配列を返す", () => {
    const html = "<div><p>ボタンなし</p></div>";
    expect(parseYearPageUrls(html)).toEqual([]);
  });
});
