import { describe, expect, it } from "vitest";
import { parseTopPageLinks, parseYearPageKijiLinks, parseDetailPage } from "./list";
import { parseJapaneseYear, parseUpdatedDate, parseMonthDay } from "./shared";

describe("parseJapaneseYear", () => {
  it("令和年度を変換する", () => {
    expect(parseJapaneseYear("令和6年")).toBe(2024);
    expect(parseJapaneseYear("令和7年")).toBe(2025);
    expect(parseJapaneseYear("令和2年")).toBe(2020);
  });

  it("令和元年を変換する", () => {
    expect(parseJapaneseYear("令和元年")).toBe(2019);
  });

  it("平成年度を変換する", () => {
    expect(parseJapaneseYear("平成30年")).toBe(2018);
    expect(parseJapaneseYear("平成24年")).toBe(2012);
  });

  it("全角数字を処理する", () => {
    expect(parseJapaneseYear("令和７年")).toBe(2025);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseJapaneseYear("2024年")).toBeNull();
    expect(parseJapaneseYear("Unknown")).toBeNull();
    expect(parseJapaneseYear("")).toBeNull();
  });
});

describe("parseUpdatedDate", () => {
  it("YYYY年M月D日形式を変換する", () => {
    expect(parseUpdatedDate("最終更新日：2025年3月14日")).toBe("2025-03-14");
    expect(parseUpdatedDate("最終更新日：2024年9月1日")).toBe("2024-09-01");
    expect(parseUpdatedDate("最終更新日：2024年4月1日")).toBe("2024-04-01");
  });

  it("月と日をゼロパディングする", () => {
    expect(parseUpdatedDate("2024年1月5日")).toBe("2024-01-05");
    expect(parseUpdatedDate("2024年10月12日")).toBe("2024-10-12");
  });

  it("解析できない場合はnullを返す", () => {
    expect(parseUpdatedDate("不明")).toBeNull();
    expect(parseUpdatedDate("")).toBeNull();
  });
});

describe("parseMonthDay", () => {
  it("XX月XX日を抽出する", () => {
    expect(parseMonthDay("12月3日 会期日程・提案理由説明等")).toEqual({ month: 12, day: 3 });
    expect(parseMonthDay("9月4日 一般質問")).toEqual({ month: 9, day: 4 });
    expect(parseMonthDay("1月16日　会期決定・議案審議等")).toEqual({ month: 1, day: 16 });
  });

  it("日付がない場合はnullを返す", () => {
    expect(parseMonthDay("目次")).toBeNull();
    expect(parseMonthDay("会期日程")).toBeNull();
    expect(parseMonthDay("")).toBeNull();
  });
});

describe("parseTopPageLinks", () => {
  it("年度別ページリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="list02253.html">令和7年</a></li>
          <li><a href="list02233.html">令和6年</a></li>
          <li><a href="list01631.html">令和5年</a></li>
          <li><a href="list01207.html">会議録トップ</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseTopPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: 2025,
      url: "https://www.town.kiyama.lg.jp/gikai/list02253.html",
    });
    expect(result[1]).toEqual({
      year: 2024,
      url: "https://www.town.kiyama.lg.jp/gikai/list02233.html",
    });
    expect(result[2]).toEqual({
      year: 2023,
      url: "https://www.town.kiyama.lg.jp/gikai/list01631.html",
    });
  });

  it("年度に対応しないリンクはスキップする", () => {
    const html = `
      <a href="list01207.html">会議録トップ</a>
      <a href="list02253.html">令和7年</a>
      <a href="list01514.html">平成24年以前</a>
    `;

    const result = parseTopPageLinks(html);
    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2025);
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="list02253.html">令和7年</a>
      <a href="list02253.html">令和7年</a>
    `;

    const result = parseTopPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    expect(parseTopPageLinks(html)).toEqual([]);
  });
});

describe("parseYearPageKijiLinks", () => {
  it("kiji番号リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="kiji0036218/index.html">会議録（令和6年第4回定例会）</a></li>
          <li><a href="kiji0035750/index.html">会議録（令和6年第3回定例会）</a></li>
          <li><a href="kiji0035597/index.html">会議録（令和6年第2回定例会）</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseYearPageKijiLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.town.kiyama.lg.jp/gikai/kiji0036218/index.html");
    expect(result[1]).toBe("https://www.town.kiyama.lg.jp/gikai/kiji0035750/index.html");
    expect(result[2]).toBe("https://www.town.kiyama.lg.jp/gikai/kiji0035597/index.html");
  });

  it("重複するリンクを除外する", () => {
    const html = `
      <a href="kiji0036218/index.html">会議録</a>
      <a href="kiji0036218/index.html">会議録</a>
    `;

    const result = parseYearPageKijiLinks(html);
    expect(result).toHaveLength(1);
  });

  it("kiji番号リンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    expect(parseYearPageKijiLinks(html)).toEqual([]);
  });
});

describe("parseDetailPage", () => {
  it("定例会のPDFレコードを抽出する", () => {
    const html = `
      <html>
      <body>
        <h1>会議録（令和6年第4回定例会）</h1>
        <p>最終更新日：2025年3月14日</p>
        <ul>
          <li><a href="3_6218_31648_up_87cl0km7.pdf">目次（PDF：130.3キロバイト）</a></li>
          <li><a href="3_6218_31649_up_ue2ptasy.pdf">会期日程（PDF：60.6キロバイト）</a></li>
          <li><a href="3_6218_31650_up_44nde6ix.pdf">12月3日 会期日程・提案理由説明等（PDF：611.7キロバイト）</a></li>
          <li><a href="3_6218_31651_up_hh1dz1pu.pdf">12月4日 一般質問（PDF：994キロバイト）</a></li>
          <li><a href="3_6218_31655_up_3hb4d7d7.pdf">12月13日 委員長報告・討論・採決（PDF：412.3キロバイト）</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.kiyama.lg.jp/gikai/kiji0036218/index.html");

    // 目次・会期日程（日付なし）は除外
    expect(result).toHaveLength(3);

    expect(result[0]!.title).toBe("会議録（令和6年第4回定例会） 12月3日 会期日程・提案理由説明等（PDF：611.7キロバイト）");
    expect(result[0]!.heldOn).toBe("2024-12-03");
    expect(result[0]!.pdfUrl).toBe("https://www.town.kiyama.lg.jp/gikai/kiji0036218/3_6218_31650_up_44nde6ix.pdf");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.detailPageUrl).toBe("https://www.town.kiyama.lg.jp/gikai/kiji0036218/index.html");

    expect(result[1]!.title).toBe("会議録（令和6年第4回定例会） 12月4日 一般質問（PDF：994キロバイト）");
    expect(result[1]!.heldOn).toBe("2024-12-04");

    expect(result[2]!.heldOn).toBe("2024-12-13");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <html>
      <body>
        <h1>会議録（令和6年第1回臨時会）</h1>
        <p>最終更新日：2024年4月1日</p>
        <ul>
          <li><a href="3_5442_25469_up_dqrd8uzw.pdf">目次</a></li>
          <li><a href="3_5442_25470_up_d4pg8pi0.pdf">会期日程</a></li>
          <li><a href="3_5442_25471_up_r2bdvode.pdf">1月16日　会期決定・議案審議等</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.kiyama.lg.jp/gikai/kiji0035442/index.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-01-16");
    expect(result[0]!.title).toBe("会議録（令和6年第1回臨時会） 1月16日 会期決定・議案審議等");
  });

  it("更新月より日付の月が大きい場合は前年とする", () => {
    // 更新日: 2025年3月 → 12月の会議は2024年
    const html = `
      <html>
      <body>
        <h1>会議録（令和6年第4回定例会）</h1>
        <p>最終更新日：2025年3月14日</p>
        <ul>
          <li><a href="pdf1.pdf">12月3日 開会日</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.kiyama.lg.jp/gikai/kiji0036218/index.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-12-03");
  });

  it("h1がない場合は空配列を返す", () => {
    const html = `
      <html>
      <body>
        <p>最終更新日：2024年9月1日</p>
        <ul>
          <li><a href="pdf1.pdf">9月3日 開会日</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.kiyama.lg.jp/gikai/kiji0035597/index.html");
    expect(result).toEqual([]);
  });

  it("最終更新日がない場合は空配列を返す", () => {
    const html = `
      <html>
      <body>
        <h1>会議録（令和6年第2回定例会）</h1>
        <ul>
          <li><a href="pdf1.pdf">9月3日 開会日</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.kiyama.lg.jp/gikai/kiji0035597/index.html");
    expect(result).toEqual([]);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `
      <html>
      <body>
        <h1>会議録（令和6年第2回定例会）</h1>
        <p>最終更新日：2024年9月1日</p>
        <ul>
          <li>リンクなし</li>
        </ul>
      </body>
      </html>
    `;

    const result = parseDetailPage(html, "https://www.town.kiyama.lg.jp/gikai/kiji0035597/index.html");
    expect(result).toEqual([]);
  });
});
