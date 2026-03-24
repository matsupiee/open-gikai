import { describe, expect, it } from "vitest";
import {
  parseDetailPagePdfs,
  parsePdfFileName,
  parseTopPage,
  parseYearPage,
} from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和元年")).toBe(2019);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年")).toBe(2019);
    expect(parseWarekiYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("会議")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("通常の会議は plenary を返す", () => {
    expect(detectMeetingType("令和7年3月会議")).toBe("plenary");
    expect(detectMeetingType("令和6年12月会議")).toBe("plenary");
  });

  it("臨時を含む場合は extraordinary を返す", () => {
    expect(detectMeetingType("令和7年1月臨時会議")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseTopPage", () => {
  it("/diet/minutes/{年度}/ 形式のリンクを抽出する", () => {
    const html = `
      <a href="/diet/minutes/2025/">令和7年</a>
      <a href="/diet/minutes/2024/">令和6年</a>
      <a href="/diet/minutes/2023/">令和5年</a>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.town.obuse.nagano.jp/diet/minutes/2025/");
    expect(result[1]).toBe("https://www.town.obuse.nagano.jp/diet/minutes/2024/");
    expect(result[2]).toBe("https://www.town.obuse.nagano.jp/diet/minutes/2023/");
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/diet/minutes/2025/">令和7年（上）</a>
      <a href="/diet/minutes/2025/">令和7年（下）</a>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
  });

  it("4桁数字以外のパターンは抽出しない", () => {
    const html = `
      <a href="/diet/minutes/">トップ</a>
      <a href="/diet/minutes/2024/">令和6年</a>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.obuse.nagano.jp/diet/minutes/2024/");
  });

  it("年度リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録トップページ</p>";
    expect(parseTopPage(html)).toEqual([]);
  });
});

describe("parseYearPage", () => {
  it("/docs/{ID}.html 形式のリンクから会議セッションを抽出する", () => {
    const html = `
      <a href="/docs/r7_3.html">令和7年3月会議</a>
      <a href="/docs/r6-12.html">令和6年12月会議</a>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.detailUrl).toBe("https://www.town.obuse.nagano.jp/docs/r7_3.html");
    expect(result[0]!.sessionTitle).toBe("令和7年3月会議");
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.detailUrl).toBe("https://www.town.obuse.nagano.jp/docs/r6-12.html");
    expect(result[1]!.sessionTitle).toBe("令和6年12月会議");
    expect(result[1]!.year).toBe(2024);
  });

  it("数値ベースの ID も抽出する", () => {
    const html = `
      <a href="/docs/327358.html">令和7年9月会議</a>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.detailUrl).toBe("https://www.town.obuse.nagano.jp/docs/327358.html");
    expect(result[0]!.sessionTitle).toBe("令和7年9月会議");
    expect(result[0]!.year).toBe(2025);
  });

  it("「会議」を含まないリンクは除外する", () => {
    const html = `
      <a href="/docs/r7_3.html">令和7年3月会議</a>
      <a href="/docs/123.html">審議内容</a>
      <a href="/docs/456.html">一般質問</a>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.sessionTitle).toBe("令和7年3月会議");
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/docs/r7_3.html">令和7年3月会議</a>
      <a href="/docs/r7_3.html">令和7年3月会議（詳細）</a>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(1);
  });

  it("全角数字のタイトルを半角に正規化する", () => {
    const html = `
      <a href="/docs/r6_12.html">令和６年１２月会議</a>
    `;

    const result = parseYearPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.sessionTitle).toBe("令和6年12月会議");
    expect(result[0]!.year).toBe(2024);
  });

  it("和暦が解析できない場合は year が null", () => {
    const html = `
      <a href="/docs/special.html">特別会議</a>
    `;

    const result = parseYearPage(html);

    // 「会議」を含むのでリストに入るが year は null
    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBeNull();
  });
});

describe("parseDetailPagePdfs", () => {
  it("相対 URL の会議録 PDF リンクを抽出して絶対 URL に変換する", () => {
    const html = `
      <a href="/fs/1/8/6/6/2/9/_/%E4%BB%A4%E5%92%8C6%E5%B9%B412%E6%9C%882%E6%97%A5%E4%BC%9A%E8%AD%B0%E9%8C%B2%E7%AC%AC1%E5%8F%B7.pdf">令和6年12月2日会議録第1号</a>
    `;

    const result = parseDetailPagePdfs(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.town.obuse.nagano.jp/fs/1/8/6/6/2/9/_/%E4%BB%A4%E5%92%8C6%E5%B9%B412%E6%9C%882%E6%97%A5%E4%BC%9A%E8%AD%B0%E9%8C%B2%E7%AC%AC1%E5%8F%B7.pdf",
    );
  });

  it("絶対 URL の会議録 PDF リンクを抽出する（%E4%BC%9A%E8%AD%B0%E9%8C%B2 = 会議録）", () => {
    const html = `
      <a href="https://www.town.obuse.nagano.jp/fs/1/2/3/4/5/6/_/%E4%BB%A4%E5%92%8C7%E5%B9%B43%E6%9C%883%E6%97%A5%E4%BC%9A%E8%AD%B0%E9%8C%B2%E7%AC%AC1%E5%8F%B7.pdf">R7.3.3</a>
    `;

    const result = parseDetailPagePdfs(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain("town.obuse.nagano.jp");
    expect(result[0]).toContain(".pdf");
  });

  it("「会議録」を含まない PDF は除外する", () => {
    const html = `
      <a href="/fs/1/2/3/_/%E5%A7%94%E5%93%A1%E4%BC%9A%E5%A0%B1%E5%91%8A%E6%9B%B8.pdf">委員会報告書</a>
    `;

    const result = parseDetailPagePdfs(html);

    expect(result).toHaveLength(0);
  });

  it("URL に 会議録 を直接含む PDF を抽出する", () => {
    const html = `
      <a href="/path/会議録第1号.pdf">会議録</a>
    `;

    const result = parseDetailPagePdfs(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.town.obuse.nagano.jp/path/会議録第1号.pdf");
  });

  it("重複 PDF URL を除外する", () => {
    const html = `
      <a href="/fs/1/2/3/_/%E4%BC%9A%E8%AD%B0%E9%8C%B2.pdf">会議録（1）</a>
      <a href="/fs/1/2/3/_/%E4%BC%9A%E8%AD%B0%E9%8C%B2.pdf">会議録（2）</a>
    `;

    const result = parseDetailPagePdfs(html);

    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録なし</p>";
    expect(parseDetailPagePdfs(html)).toEqual([]);
  });
});

describe("parsePdfFileName", () => {
  it("令和の年月日と号数を抽出する（実際のサイト URL）", () => {
    // 実際のサイトのURL形式: /fs/{数字パス}/_/{URLエンコードされたファイル名}.pdf
    // デコード後: 令和6年12月2日会議録第1号.pdf
    const url = "https://www.town.obuse.nagano.jp/fs/1/8/6/6/2/9/_/%E4%BB%A4%E5%92%8C6%E5%B9%B412%E6%9C%882%E6%97%A5%E4%BC%9A%E8%AD%B0%E9%8C%B2%E7%AC%AC1%E5%8F%B7.pdf";
    const result = parsePdfFileName(url);

    expect(result).not.toBeNull();
    expect(result!.heldOnLabel).toBe("令和6年12月2日");
    expect(result!.number).toBe(1);
  });

  it("号数が複数桁でも正しくパースする", () => {
    // デコード後: 令和6年12月13日会議録第4号.pdf
    const url = "https://www.town.obuse.nagano.jp/fs/1/8/6/6/3/2/_/%E4%BB%A4%E5%92%8C6%E5%B9%B412%E6%9C%8813%E6%97%A5%E4%BC%9A%E8%AD%B0%E9%8C%B2%E7%AC%AC4%E5%8F%B7.pdf";
    const result = parsePdfFileName(url);

    expect(result).not.toBeNull();
    expect(result!.heldOnLabel).toBe("令和6年12月13日");
    expect(result!.number).toBe(4);
  });

  it("会議録パターンに合致しない場合は null を返す", () => {
    const url = "https://example.com/path/委員会報告書.pdf";
    expect(parsePdfFileName(url)).toBeNull();
  });
});
