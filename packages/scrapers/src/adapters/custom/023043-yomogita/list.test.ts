import { describe, expect, it } from "vitest";
import { parseListPage, parseDateFromFilename, parseMeetingInfo } from "./list";
import { parseEraYear, toHalfWidth } from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角数字に変換する", () => {
    expect(toHalfWidth("令和７年")).toBe("令和7年");
    expect(toHalfWidth("第４回")).toBe("第4回");
    expect(toHalfWidth("第１号")).toBe("第1号");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("令和7年")).toBe("令和7年");
  });
});

describe("parseEraYear", () => {
  it("令和7年を2025に変換する", () => {
    expect(parseEraYear("令和７年")).toBe(2025);
  });

  it("令和6年を2024に変換する", () => {
    expect(parseEraYear("令和６年")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(parseEraYear("令和元年")).toBe(2019);
  });

  it("平成31年を2019に変換する", () => {
    expect(parseEraYear("平成31年")).toBe(2019);
  });

  it("解析できない場合は null を返す", () => {
    expect(parseEraYear("不明")).toBeNull();
    expect(parseEraYear("2025年")).toBeNull();
  });
});

describe("parseDateFromFilename", () => {
  it("MMDD パターンのファイル名から日付を取得する", () => {
    expect(parseDateFromFilename("r07-04t-01-1203.pdf", 2025)).toBe("2025-12-03");
    expect(parseDateFromFilename("r06-04t-01-1204.pdf", 2024)).toBe("2024-12-04");
    expect(parseDateFromFilename("r07-03t-01-0909.pdf", 2025)).toBe("2025-09-09");
  });

  it("YYYYMMDD パターンのファイル名から日付を取得する", () => {
    expect(parseDateFromFilename("giji_kessan1_20230905.pdf", 2023)).toBe("2023-09-05");
    expect(parseDateFromFilename("giji_yosan1_20220301.pdf", 2022)).toBe("2022-03-01");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseDateFromFilename("R6-3-teirei-gijiroku1.pdf", 2024)).toBeNull();
    expect(parseDateFromFilename("giji_r05-04-01.pdf", 2023)).toBeNull();
  });
});

describe("parseMeetingInfo", () => {
  it("定例会タイトルから回数と号数を抽出する", () => {
    const result = parseMeetingInfo("令和７年第４回蓬田村議会定例会会議録（第１号）");
    expect(result).not.toBeNull();
    expect(result!.sessionNum).toBe(4);
    expect(result!.issueNum).toBe(1);
    expect(result!.committeeType).toBeNull();
  });

  it("全角数字の定例会タイトルを正しく解析する", () => {
    const result = parseMeetingInfo("令和７年第４回蓬田村議会定例会会議録（第１号）");
    expect(result!.sessionNum).toBe(4);
    expect(result!.issueNum).toBe(1);
  });

  it("予算特別委員会タイトルから種別と号数を抽出する", () => {
    const result = parseMeetingInfo("予算特別委員会会議録（第１号）");
    expect(result).not.toBeNull();
    expect(result!.sessionNum).toBeNull();
    expect(result!.issueNum).toBe(1);
    expect(result!.committeeType).toBe("予算");
  });

  it("決算特別委員会タイトルから種別と号数を抽出する", () => {
    const result = parseMeetingInfo("決算特別委員会会議録（第２号）");
    expect(result).not.toBeNull();
    expect(result!.committeeType).toBe("決算");
    expect(result!.issueNum).toBe(2);
  });

  it("解析できないタイトルは null を返す", () => {
    expect(parseMeetingInfo("不明なタイトル")).toBeNull();
    expect(parseMeetingInfo("")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h2 と PDF リンクから会議録一覧を取得する", () => {
    const html = `
      <h2>令和７年</h2>
      <ul>
        <li><a href="files/r07-04t-01-1203.pdf" target="_blank">
          令和７年第４回蓬田村議会定例会会議録（第１号）
          <img alt="PDFファイル" class="wcv_ww_fileicon" src="../../_wcv/images/icon/pdf.gif">
          <span class="wcv_ww_filesize">(338KB)</span>
        </a></li>
        <li><a href="files/r07-03t-01-0909.pdf" target="_blank">
          令和７年第３回蓬田村議会定例会会議録（第１号）
          <span class="wcv_ww_filesize">(290KB)</span>
        </a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和７年第４回蓬田村議会定例会会議録（第１号）");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.heldOn).toBe("2025-12-03");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.yomogita.lg.jp/sonsei/gikai/files/r07-04t-01-1203.pdf",
    );
    expect(meetings[1]!.title).toBe("令和７年第３回蓬田村議会定例会会議録（第１号）");
    expect(meetings[1]!.heldOn).toBe("2025-09-09");
  });

  it("複数の年度を正しく処理する", () => {
    const html = `
      <h2>令和７年</h2>
      <ul>
        <li><a href="files/r07-04t-01-1203.pdf">令和７年第４回蓬田村議会定例会会議録（第１号）</a></li>
      </ul>
      <h2>令和６年</h2>
      <ul>
        <li><a href="files/r06-04t-01-1204.pdf">令和６年第４回蓬田村議会定例会会議録（第１号）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[1]!.year).toBe(2024);
  });

  it("特別委員会リンクも収集する", () => {
    const html = `
      <h2>令和７年</h2>
      <ul>
        <li><a href="files/r07-k-01-0909.pdf">決算特別委員会会議録（第１号）</a></li>
        <li><a href="files/r07-y-01-0301.pdf">予算特別委員会会議録（第１号）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("決算特別委員会会議録（第１号）");
    expect(meetings[0]!.year).toBe(2025);
  });

  it("令和元年を2019として扱う", () => {
    const html = `
      <h2>令和元年</h2>
      <ul>
        <li><a href="files/r01-04t-01-1210.pdf">令和元年第４回蓬田村議会定例会会議録（第１号）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2019);
  });

  it("日付情報が取得できないファイル名の場合 heldOn が null", () => {
    const html = `
      <h2>令和６年</h2>
      <ul>
        <li><a href="files/R6-3-teirei-gijiroku1.pdf">令和６年第３回蓬田村議会定例会会議録（第１号）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("span でラップされたリンクテキストも正しく取得する", () => {
    const html = `
      <h2>令和６年</h2>
      <ul>
        <li><a href="files/r06-04t-01-1204.pdf"><span style="font-size:100%;">令和６年第４回蓬田村議会定例会会議録（第１号）</span></a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和６年第４回蓬田村議会定例会会議録（第１号）");
  });

  it("HTML が空の場合は空配列を返す", () => {
    const meetings = parseListPage("<html><body></body></html>");
    expect(meetings).toHaveLength(0);
  });

  it("h2 が会議録以外（リンクなし）の場合はスキップする", () => {
    const html = `
      <h2>お知らせ</h2>
      <p>情報はありません。</p>
      <h2>令和７年</h2>
      <ul>
        <li><a href="files/r07-04t-01-1203.pdf">令和７年第４回蓬田村議会定例会会議録（第１号）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2025);
  });
});
