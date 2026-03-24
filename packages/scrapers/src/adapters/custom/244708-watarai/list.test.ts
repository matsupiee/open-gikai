import { describe, expect, it } from "vitest";
import { toListRecord } from "./list";
import {
  parseWarekiYear,
  detectMeetingType,
  extractFrmIds,
  extractPdfLinks,
  extractSessionNumber,
} from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和5年")).toBe(2023);
    expect(parseWarekiYear("令和6年")).toBe(2024);
    expect(parseWarekiYear("令和7年")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成25年")).toBe(2013);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("第1回定例会")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和7年第1回度会町議会定例会会議録")).toBe("plenary");
    expect(detectMeetingType("令和6年第2回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
    expect(detectMeetingType("令和6年臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務常任委員会")).toBe("committee");
  });

  it("委員会付託は定例会として扱う", () => {
    expect(detectMeetingType("第2回定例会委員会付託")).toBe("plenary");
  });
});

describe("extractFrmIds", () => {
  it("frmCd=8-6-0-0-0 のリンクから frmId を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/contents_detail.php?co=cat&frmId=3484&frmCd=8-6-0-0-0">令和7年</a></li>
        <li><a href="/contents_detail.php?co=cat&frmId=3294&frmCd=8-6-0-0-0">令和6年</a></li>
        <li><a href="/contents_detail.php?co=cat&frmId=3000&frmCd=8-6-0-0-0">令和5年</a></li>
      </ul>
    `;

    const result = extractFrmIds(html);

    expect(result).toHaveLength(3);
    expect(result).toContain(3484);
    expect(result).toContain(3294);
    expect(result).toContain(3000);
  });

  it("重複する frmId は一度だけ返す", () => {
    const html = `
      <a href="/contents_detail.php?co=cat&frmId=3294&frmCd=8-6-0-0-0">令和6年</a>
      <a href="/contents_detail.php?co=cat&frmId=3294&frmCd=8-6-0-0-0">令和6年（再掲）</a>
    `;

    const result = extractFrmIds(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(3294);
  });

  it("frmCd が異なるリンクは除外する", () => {
    const html = `
      <a href="/contents_detail.php?co=cat&frmId=3484&frmCd=8-6-0-0-0">会議録</a>
      <a href="/contents_detail.php?co=cat&frmId=9999&frmCd=8-0-0-0-0">カテゴリ</a>
    `;

    const result = extractFrmIds(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(3484);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(extractFrmIds("<div><p>準備中</p></div>")).toEqual([]);
  });
});

describe("extractPdfLinks", () => {
  it("cmsfiles 配下の PDF リンクを絶対 URL に変換して抽出する", () => {
    const html = `
      <ul>
        <li>
          <a href="./cmsfiles/contents/0000003/3484/R070304kaigiroku.pdf">令和7年第1回定例会（初日）</a>
        </li>
        <li>
          <a href="./cmsfiles/contents/0000003/3484/R070318kaigiroku.pdf">令和7年第1回定例会（最終日）</a>
        </li>
      </ul>
    `;
    const pageUrl = "https://www.town.watarai.lg.jp/contents_detail.php?co=cat&frmId=3484&frmCd=8-6-0-0-0";

    const result = extractPdfLinks(html, pageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年第1回定例会（初日）");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.watarai.lg.jp/cmsfiles/contents/0000003/3484/R070304kaigiroku.pdf"
    );
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.watarai.lg.jp/cmsfiles/contents/0000003/3484/R070318kaigiroku.pdf"
    );
  });

  it("cmsfiles 以外の PDF リンクは除外する", () => {
    const html = `
      <a href="./cmsfiles/contents/0000003/3484/R070304kaigiroku.pdf">会議録</a>
      <a href="/other/path/document.pdf">別の文書</a>
    `;
    const pageUrl = "https://www.town.watarai.lg.jp/contents_detail.php?co=cat&frmId=3484&frmCd=8-6-0-0-0";

    const result = extractPdfLinks(html, pageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("/cmsfiles/");
  });

  it("平成分のファイルパスも正しく解決する", () => {
    const html = `
      <a href="./cmsfiles/contents/0000000/912/H260306.shoniti.pdf">平成26年第1回（初日）</a>
    `;
    const pageUrl = "https://www.town.watarai.lg.jp/contents_detail.php?co=cat&frmId=912&frmCd=8-6-0-0-0";

    const result = extractPdfLinks(html, pageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.watarai.lg.jp/cmsfiles/contents/0000000/912/H260306.shoniti.pdf"
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<div><p>準備中です。</p></div>";
    const result = extractPdfLinks(html, "https://www.town.watarai.lg.jp/contents_detail.php?co=cat&frmId=3484&frmCd=8-6-0-0-0");
    expect(result).toEqual([]);
  });
});

describe("extractSessionNumber", () => {
  it("第N回の回数を抽出する", () => {
    expect(extractSessionNumber("令和7年第1回定例会会議録")).toBe(1);
    expect(extractSessionNumber("令和6年第3回度会町議会定例会会議録")).toBe(3);
    expect(extractSessionNumber("第4回定例会")).toBe(4);
  });

  it("回数がない場合はnullを返す", () => {
    expect(extractSessionNumber("令和6年定例会会議録")).toBeNull();
    expect(extractSessionNumber("")).toBeNull();
  });
});

describe("toListRecord", () => {
  it("WataraiPdfRecord を ListRecord に変換する", () => {
    const record = {
      title: "令和7年第1回度会町議会定例会会議録",
      meetingType: "plenary",
      pdfUrl: "https://www.town.watarai.lg.jp/cmsfiles/contents/0000003/3484/R070304kaigiroku.pdf",
      year: 2025,
      sessionNumber: 1,
      frmId: 3484,
    };

    const result = toListRecord(record);

    expect(result.detailParams["title"]).toBe("令和7年第1回度会町議会定例会会議録");
    expect(result.detailParams["meetingType"]).toBe("plenary");
    expect(result.detailParams["pdfUrl"]).toBe(
      "https://www.town.watarai.lg.jp/cmsfiles/contents/0000003/3484/R070304kaigiroku.pdf"
    );
    expect(result.detailParams["year"]).toBe(2025);
    expect(result.detailParams["sessionNumber"]).toBe(1);
    expect(result.detailParams["frmId"]).toBe(3484);
  });
});
