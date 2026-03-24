import { describe, expect, it } from "vitest";
import { extractHeldOnFromText, toHalfWidth, detectMeetingType } from "./shared";
import { extractYearFromFilename, parseListPage, resolveUrl } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和８年")).toBe("令和8年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("令和7年6月定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("臨時会")).toBe("extraordinary");
  });

  it("臨時議会をextraordinaryと判定する", () => {
    expect(detectMeetingType("令和8年第1回臨時議会")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("社会文教常任委員会")).toBe("committee");
  });
});

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(extractHeldOnFromText("令和７年６月５日 午前10時30分")).toBe(
      "2025-06-05",
    );
  });

  it("半角数字の令和日付を変換する", () => {
    expect(extractHeldOnFromText("令和7年6月5日 午前10時30分")).toBe(
      "2025-06-05",
    );
  });

  it("令和元年に対応する", () => {
    expect(extractHeldOnFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(extractHeldOnFromText("平成30年12月10日")).toBe("2018-12-10");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromText("2024年3月1日")).toBeNull();
  });
});

describe("resolveUrl", () => {
  it("相対URLにオリジンを付与する", () => {
    expect(
      resolveUrl("/fs/6/8/7/7/5/_/7.6.05%E9%96%8B%E4%BC%9A%E8%AD%B0%E6%A1%88%E8%AA%AC%E6%98%8E.pdf", "https://www.vill.ogawa.nagano.jp"),
    ).toBe(
      "https://www.vill.ogawa.nagano.jp/fs/6/8/7/7/5/_/7.6.05%E9%96%8B%E4%BC%9A%E8%AD%B0%E6%A1%88%E8%AA%AC%E6%98%8E.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl("https://www.vill.ogawa.nagano.jp/fs/test.pdf", "https://www.vill.ogawa.nagano.jp"),
    ).toBe("https://www.vill.ogawa.nagano.jp/fs/test.pdf");
  });

  it("プロトコル相対URLにhttps:を付与する", () => {
    expect(
      resolveUrl("//www.vill.ogawa.nagano.jp/fs/test.pdf", "https://www.vill.ogawa.nagano.jp"),
    ).toBe("https://www.vill.ogawa.nagano.jp/fs/test.pdf");
  });
});

describe("extractYearFromFilename", () => {
  it("R7.x.x 形式から令和7年(2025)を取得する", () => {
    expect(extractYearFromFilename("R7.6.06一般質問.pdf")).toBe(2025);
  });

  it("R8.x.x 形式から令和8年(2026)を取得する", () => {
    expect(extractYearFromFilename("R8.1.13臨時議会.pdf")).toBe(2026);
  });

  it("7.x.x 形式から令和7年(2025)を取得する", () => {
    expect(extractYearFromFilename("7.6.05開会議案説明.pdf")).toBe(2025);
  });

  it("7.12.x 形式から令和7年(2025)を取得する", () => {
    expect(extractYearFromFilename("7.12.4議案説明.pdf")).toBe(2025);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractYearFromFilename("readme.pdf")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h2/h3見出しとaタグからPDFリンクを抽出する", () => {
    const html = `
      <h2>6月</h2>
      <h3>説明</h3>
      <p><a href="/fs/6/8/7/7/5/_/7.6.05%E9%96%8B%E4%BC%9A%E8%AD%B0%E6%A1%88%E8%AA%AC%E6%98%8E.pdf">R7.6.05開会議案説明.pdf(455KB)</a></p>
      <h3>一般質問</h3>
      <p><a href="/fs/6/8/7/7/9/_/7.6.06%E4%B8%80%E8%88%AC%E8%B3%AA%E5%95%8F.pdf">R7.6.06一般質問.pdf(688KB)</a></p>
    `;

    const result = parseListPage(html, "https://www.vill.ogawa.nagano.jp");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年6月定例会 説明",
      pdfUrl: "https://www.vill.ogawa.nagano.jp/fs/6/8/7/7/5/_/7.6.05%E9%96%8B%E4%BC%9A%E8%AD%B0%E6%A1%88%E8%AA%AC%E6%98%8E.pdf",
      meetingType: "plenary",
      monthSection: "6月",
      typeSection: "説明",
    });
    expect(result[1]!.title).toBe("令和7年6月定例会 一般質問");
    expect(result[1]!.typeSection).toBe("一般質問");
  });

  it("臨時会のリンクをextraordinaryと判定する", () => {
    const html = `
      <h2>臨時会</h2>
      <h3>説明・質疑・討論・採決</h3>
      <p><a href="/fs/6/8/7/8/2/_/7.7.15%E7%AC%AC1%E5%9B%9E%E8%87%A8%E6%99%82%E4%BC%9A.pdf">R7.7.15令和7年第1回臨時会.pdf(229KB)</a></p>
    `;

    const result = parseListPage(html, "https://www.vill.ogawa.nagano.jp");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.monthSection).toBe("臨時会");
  });

  it("複数の月別セクションを正しく処理する", () => {
    const html = `
      <h2>6月</h2>
      <h3>説明</h3>
      <p><a href="/fs/6/8/7/7/5/_/7.6.05%E8%AA%AC%E6%98%8E.pdf">R7.6.05開会議案説明.pdf</a></p>
      <h2>9月</h2>
      <h3>説明</h3>
      <p><a href="/fs/7/1/2/1/1/_/7.09.03%E8%AA%AC%E6%98%8E.pdf">R7.09.03説明.pdf</a></p>
    `;

    const result = parseListPage(html, "https://www.vill.ogawa.nagano.jp");

    expect(result).toHaveLength(2);
    expect(result[0]!.monthSection).toBe("6月");
    expect(result[1]!.monthSection).toBe("9月");
  });

  it("/fs/ を含まないリンクは無視する", () => {
    const html = `
      <h2>6月</h2>
      <h3>説明</h3>
      <p><a href="/docs/other.html">その他リンク</a></p>
      <p><a href="/fs/6/8/7/7/5/_/7.6.05%E8%AA%AC%E6%98%8E.pdf">R7.6.05開会議案説明.pdf</a></p>
    `;

    const result = parseListPage(html, "https://www.vill.ogawa.nagano.jp");
    expect(result).toHaveLength(1);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html, "https://www.vill.ogawa.nagano.jp")).toEqual([]);
  });

  it("R8形式のファイル名からも年を正しく取得する", () => {
    const html = `
      <h2>臨時会</h2>
      <h3>説明・質疑・討論・採決</h3>
      <p><a href="/fs/7/3/3/7/6/_/R8.1.13%E8%87%A8%E6%99%82%E8%AD%B0%E4%BC%9A.pdf">R8.1.13令和8年第1回臨時議会.pdf(409KB)</a></p>
    `;

    const result = parseListPage(html, "https://www.vill.ogawa.nagano.jp");
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和8年臨時会 説明・質疑・討論・採決");
    expect(result[0]!.meetingType).toBe("extraordinary");
  });
});
