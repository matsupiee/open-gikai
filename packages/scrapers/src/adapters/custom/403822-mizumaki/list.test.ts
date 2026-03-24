import { describe, expect, it } from "vitest";
import { parseNendoCodes, parseMeetingLinks, extractGijirokuRecords } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第4回定例会")).toBe(2025);
    expect(parseWarekiYear("令和6年第1回臨時会")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第4回定例会")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("第1回定例会")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseNendoCodes", () => {
  it("トップページから年度コードを抽出する（相対パス）", () => {
    const html = `
      <ul>
        <li><a href="./200/index.html">令和7年</a></li>
        <li><a href="./190/index.html">令和6年</a></li>
        <li><a href="./140/index.html">令和元年（平成31年）</a></li>
      </ul>
    `;

    const result = parseNendoCodes(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("200");
    expect(result[1]).toBe("190");
    expect(result[2]).toBe("140");
  });

  it("トップページから年度コードを抽出する（絶対パス）", () => {
    const html = `
      <a href="/li/gyosei/030/010/200/index.html">令和7年</a>
      <a href="/li/gyosei/030/010/190/index.html">令和6年</a>
    `;

    const result = parseNendoCodes(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe("200");
    expect(result[1]).toBe("190");
  });

  it("重複する年度コードを除外する", () => {
    const html = `
      <a href="./200/index.html">令和7年</a>
      <a href="./200/index.html">令和7年（再掲）</a>
    `;

    const result = parseNendoCodes(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("200");
  });

  it("年度リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseNendoCodes(html)).toEqual([]);
  });
});

describe("parseMeetingLinks", () => {
  it("年度インデックスページから会議詳細ページリンクを抽出する（相対パス）", () => {
    const html = `
      <ul>
        <li><a href="../../../../../s043/gyosei/040/100/190/010/20230906152548.html">第2回定例会（6月）</a></li>
        <li><a href="../../../../../s043/gyosei/040/100/190/050/20240321140615.html">第6回定例会（12月）</a></li>
      </ul>
    `;

    const result = parseMeetingLinks(html, "190");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第2回定例会（6月）",
      url: "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/010/20230906152548.html",
      pageId: "190_010_20230906152548",
      nendoCode: "190",
      meetingNo: "010",
    });
    expect(result[1]).toEqual({
      title: "第6回定例会（12月）",
      url: "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/050/20240321140615.html",
      pageId: "190_050_20240321140615",
      nendoCode: "190",
      meetingNo: "050",
    });
  });

  it("会議番号なしのリンクも抽出する（会議番号000として扱う）", () => {
    const html = `
      <a href="../../../../../s043/gyosei/040/100/190/20230906152548.html">第1回定例会（3月）</a>
    `;

    const result = parseMeetingLinks(html, "190");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingNo).toBe("000");
    expect(result[0]!.pageId).toBe("190_000_20230906152548");
  });

  it("対象年度コード以外のリンクを除外する", () => {
    const html = `
      <a href="../../../../../s043/gyosei/040/100/190/010/20230906152548.html">令和6年定例会</a>
      <a href="../../../../../s043/gyosei/040/100/200/010/20250306152548.html">令和7年定例会</a>
    `;

    const result = parseMeetingLinks(html, "190");
    expect(result).toHaveLength(1);
    expect(result[0]!.nendoCode).toBe("190");
  });

  it("重複するpageIdを除外する", () => {
    const html = `
      <a href="../../../../../s043/gyosei/040/100/190/010/20230906152548.html">第2回定例会</a>
      <a href="../../../../../s043/gyosei/040/100/190/010/20230906152548.html">第2回定例会（再掲）</a>
    `;

    const result = parseMeetingLinks(html, "190");
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links</p>";
    expect(parseMeetingLinks(html, "190")).toEqual([]);
  });
});

describe("extractGijirokuRecords", () => {
  it("gijiroku を含む PDF リンクをファイル名から日付を抽出して返す", () => {
    const html = `
      <h2>6月3日（提案）</h2>
      <li><a href="./R6.6.3gijinittei.pdf">令和6年第2回水巻町議会定例会議事日程（6月3日）</a></li>
      <li><a href="./R6.6.3gijiroku.pdf">令和6年第2回水巻町議会定例会会議録（6月3日）</a></li>
      <h2>6月6日（質疑・付託）</h2>
      <li><a href="./R6.6.6gijinittei.pdf">議事日程</a></li>
      <li><a href="./R6.6.6gijiroku.pdf">会議録</a></li>
    `;

    const link = {
      title: "第2回定例会（6月）",
      url: "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/010/20230906152548.html",
      pageId: "190_010_20230906152548",
      nendoCode: "190",
      meetingNo: "010",
    };

    const result = extractGijirokuRecords(html, link, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/010/R6.6.3gijiroku.pdf"
    );
    expect(result[0]!.heldOn).toBe("2024-06-03");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.title).toBe("第2回定例会（6月）");
    expect(result[1]!.heldOn).toBe("2024-06-06");
  });

  it("nittei を含む PDF を除外し gijiroku のみを返す", () => {
    const html = `
      <li><a href="./R6.6.3gijinittei.pdf">議事日程</a></li>
      <li><a href="./R6.6.3gijiroku.pdf">会議録</a></li>
    `;

    const link = {
      title: "第2回定例会（6月）",
      url: "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/010/20230906152548.html",
      pageId: "190_010_20230906152548",
      nendoCode: "190",
      meetingNo: "010",
    };

    const result = extractGijirokuRecords(html, link, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("gijiroku");
    expect(result[0]!.pdfUrl).not.toContain("nittei");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <li><a href="./R6.9.30gijiroku.pdf">会議録</a></li>
    `;

    const link = {
      title: "第4回臨時会（9月）",
      url: "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/030/20230906151054.html",
      pageId: "190_030_20230906151054",
      nendoCode: "190",
      meetingNo: "030",
    };

    const result = extractGijirokuRecords(html, link, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("12月開催会議で翌年1-3月の継続会は翌年として扱う", () => {
    const html = `
      <li><a href="./R6.12.3gijiroku.pdf">会議録（12月3日）</a></li>
      <li><a href="./R7.1.15gijiroku.pdf">会議録（1月15日）</a></li>
    `;

    const link = {
      title: "第6回定例会（12月）",
      url: "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/050/20241206152548.html",
      pageId: "190_050_20241206152548",
      nendoCode: "190",
      meetingNo: "050",
    };

    const result = extractGijirokuRecords(html, link, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2024-12-03");
    expect(result[1]!.heldOn).toBe("2025-01-15");
  });

  it("gijirokuリンクがない場合は空配列を返す", () => {
    const html = `
      <li><a href="./R6.6.3gijinittei.pdf">議事日程</a></li>
    `;

    const link = {
      title: "第2回定例会（6月）",
      url: "https://www.town.mizumaki.lg.jp/s043/gyosei/040/100/190/010/20230906152548.html",
      pageId: "190_010_20230906152548",
      nendoCode: "190",
      meetingNo: "010",
    };

    const result = extractGijirokuRecords(html, link, 2024);
    expect(result).toEqual([]);
  });
});
