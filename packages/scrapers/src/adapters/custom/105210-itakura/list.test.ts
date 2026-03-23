import { describe, expect, it } from "vitest";
import { parseDetailLinks, extractPdfRecords } from "./list";
import { parseWarekiYear, detectMeetingType, yearToPathSegment } from "./shared";

describe("yearToPathSegment", () => {
  it("令和6年（2024）を d000180 に変換する", () => {
    expect(yearToPathSegment(2024)).toBe("d000180");
  });

  it("令和7年（2025）を d000190 に変換する", () => {
    expect(yearToPathSegment(2025)).toBe("d000190");
  });

  it("令和元年・平成31年（2019）を d000130 に変換する", () => {
    expect(yearToPathSegment(2019)).toBe("d000130");
  });

  it("平成19年（2007）を d000070 に変換する", () => {
    expect(yearToPathSegment(2007)).toBe("d000070");
  });

  it("マッピングにない年は null を返す", () => {
    expect(yearToPathSegment(2000)).toBeNull();
    expect(yearToPathSegment(2027)).toBeNull();
  });
});

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年 第4回定例会（12月）")).toBe(2024);
    expect(parseWarekiYear("令和7年 第1回定例会（3月）")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年 第1回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年 第3回定例会")).toBe(2018);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年 第4回定例会（12月）")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和6年 第1回臨時会（2月21日）")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("予算決算常任委員会")).toBe("committee");
  });
});

describe("parseDetailLinks", () => {
  it("年度別ページから詳細ページリンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li><a href="../../../cont/s034000/d034010/202329093535-45.html">令和6年 第4回定例会（12月）</a></li>
          <li><a href="../../../cont/s034000/d034010/202329093535-44.html">令和6年 第3回定例会（9月）</a></li>
          <li><a href="../../../cont/s034000/d034010/202203290935-50.html">令和6年 第1回臨時会</a></li>
        </ul>
      </body>
      </html>
    `;

    const result = parseDetailLinks(
      html,
      "https://www.town.itakura.gunma.jp/d000070/d000030/d000180/index.html"
    );

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe(
      "https://www.town.itakura.gunma.jp/cont/s034000/d034010/202329093535-45.html"
    );
    expect(result[1]!.url).toBe(
      "https://www.town.itakura.gunma.jp/cont/s034000/d034010/202329093535-44.html"
    );
    expect(result[2]!.url).toBe(
      "https://www.town.itakura.gunma.jp/cont/s034000/d034010/202203290935-50.html"
    );
  });

  it("重複する URL を除外する", () => {
    const html = `
      <a href="../../../cont/s034000/d034010/202329093535-45.html">令和6年 第4回定例会</a>
      <a href="../../../cont/s034000/d034010/202329093535-45.html">令和6年 第4回定例会</a>
    `;

    const result = parseDetailLinks(
      html,
      "https://www.town.itakura.gunma.jp/d000070/d000030/d000180/index.html"
    );

    expect(result).toHaveLength(1);
  });

  it("d034010 以外のリンクは除外する", () => {
    const html = `
      <a href="../../../cont/s034000/d034010/202329093535-45.html">定例会</a>
      <a href="/index.html">トップページ</a>
      <a href="../../../d000050/index.html">その他</a>
    `;

    const result = parseDetailLinks(
      html,
      "https://www.town.itakura.gunma.jp/d000070/d000030/d000180/index.html"
    );

    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    const result = parseDetailLinks(
      html,
      "https://www.town.itakura.gunma.jp/d000070/d000030/d000180/index.html"
    );
    expect(result).toEqual([]);
  });
});

describe("extractPdfRecords", () => {
  it("詳細ページから PDF レコードを抽出する", () => {
    const html = `
      <html>
      <body>
        <h2>令和6年 第4回定例会（12月）</h2>
        <p>令和6年第4回定例会（12月）の会議録は、下記のとおりとなっています。</p>
        <ul>
          <li>12月10日</li>
          <li>12月11日</li>
          <li>12月12日</li>
          <li>12月13日</li>
        </ul>
        <a href="../d034040/R6_4_kaigiroku_honkaigi.pdf">本会議（12月10日、12月11日、12月12日、12月13日）（PDF:3,597 KB）</a>
        <a href="../d034040/20241210_kaigiroku_yosankessan.pdf">予算決算常任委員会　補正予算審査（12月10日）（PDF:258 KB）</a>
      </body>
      </html>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.itakura.gunma.jp/cont/s034000/d034010/202329093535-45.html",
      2024
    );

    expect(result).toHaveLength(2);

    expect(result[0]!.title).toBe("令和6年 第4回定例会（12月） 本会議");
    expect(result[0]!.heldOn).toBe("2024-12-10");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.itakura.gunma.jp/cont/s034000/d034040/R6_4_kaigiroku_honkaigi.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.detailUrl).toBe(
      "https://www.town.itakura.gunma.jp/cont/s034000/d034010/202329093535-45.html"
    );

    expect(result[1]!.title).toBe("令和6年 第4回定例会（12月） 予算決算常任委員会 補正予算審査");
    expect(result[1]!.heldOn).toBe("2024-12-10");
    expect(result[1]!.meetingType).toBe("plenary");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <h2>令和6年 第1回臨時会（2月21日）</h2>
      <a href="../d034040/R6_rinzikai_1_kaigiroku.pdf">本会議（2月21日）（PDF:150 KB）</a>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.itakura.gunma.jp/cont/s034000/d034010/202203290935-50.html",
      2024
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-02-21");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和6年 第4回定例会（12月）</h2>
      <p>準備中です。</p>
    `;

    const result = extractPdfRecords(
      html,
      "https://www.town.itakura.gunma.jp/cont/s034000/d034010/202329093535-45.html",
      2024
    );

    expect(result).toEqual([]);
  });
});
