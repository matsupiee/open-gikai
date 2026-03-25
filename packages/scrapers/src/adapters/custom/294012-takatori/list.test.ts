import { describe, expect, it } from "vitest";
import { parseMeetingLinks, parsePdfLinks } from "./list";

describe("parseMeetingLinks", () => {
  it("contents_detail.php リンクから会議情報を抽出する", () => {
    const html = `
      <ul>
        <li><a href="contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0">第4回定例会</a></li>
        <li><a href="contents_detail.php?co=cat&frmId=2527&frmCd=1-1-5-5-0">第3回定例会</a></li>
        <li><a href="contents_detail.php?co=cat&frmId=2338&frmCd=1-1-5-4-0">第4回定例会</a></li>
      </ul>
    `;

    const meetings = parseMeetingLinks(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.frmId).toBe("2539");
    expect(meetings[0]!.frmCd).toBe("1-1-5-5-0");
    expect(meetings[0]!.title).toBe("第4回定例会");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.detailUrl).toContain("frmId=2539");
  });

  it("重複した frmId は除外する", () => {
    const html = `
      <li><a href="contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0">第4回定例会</a></li>
      <li><a href="contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0">第4回定例会（再掲）</a></li>
    `;

    const meetings = parseMeetingLinks(html);
    expect(meetings).toHaveLength(1);
  });

  it("frmCd=1-1-5-0-0（年度コード0）は除外する", () => {
    const html = `
      <li><a href="contents_detail.php?co=cat&frmId=100&frmCd=1-1-5-0-0">全年度一覧</a></li>
      <li><a href="contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0">第4回定例会</a></li>
    `;

    const meetings = parseMeetingLinks(html);
    // 年度コード 0 は year が null になるのでスキップされる
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.frmId).toBe("2539");
  });

  it("令和5年（frmCd=1-1-5-3-0）の year が 2023 になる", () => {
    const html = `
      <li><a href="contents_detail.php?co=cat&frmId=2042&frmCd=1-1-5-3-0">第4回定例会</a></li>
    `;

    // 年度コード3 = 令和5年 = 2023
    const meetings = parseMeetingLinks(html);
    expect(meetings[0]!.year).toBe(2023);
  });

  it("令和3年（frmCd=1-1-5-1-0）の year が 2021 になる", () => {
    const html = `
      <li><a href="contents_detail.php?co=cat&frmId=1377&frmCd=1-1-5-1-0">第4回定例会</a></li>
    `;

    // 年度コード1 = 令和3年 = 2021
    const meetings = parseMeetingLinks(html);
    expect(meetings[0]!.year).toBe(2021);
  });

  it("空の HTML は空配列を返す", () => {
    const meetings = parseMeetingLinks("");
    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL の detailUrl を生成する", () => {
    const html = `
      <li><a href="contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0">第4回定例会</a></li>
    `;

    const meetings = parseMeetingLinks(html);
    expect(meetings[0]!.detailUrl).toBe(
      "https://www.town.takatori.nara.jp/contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0",
    );
  });
});

describe("parsePdfLinks", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <div>
        <a href="/cmsfiles/contents/0000002/2539/1.pdf">本会議　2月24日</a>
      </div>
    `;
    const baseUrl =
      "https://www.town.takatori.nara.jp/contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0";

    const pdfs = parsePdfLinks(html, baseUrl);

    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.town.takatori.nara.jp/cmsfiles/contents/0000002/2539/1.pdf",
    );
    expect(pdfs[0]!.label).toBe("本会議　2月24日");
  });

  it("複数の PDF リンクを抽出する", () => {
    const html = `
      <a href="/cmsfiles/contents/0000001/1295/1.pdf">第1回</a>
      <a href="/cmsfiles/contents/0000001/1295/2.pdf">第2回</a>
      <a href="/cmsfiles/contents/0000001/1295/3.pdf">第3回</a>
    `;
    const baseUrl = "https://www.town.takatori.nara.jp/contents_detail.php?co=cat&frmId=1295&frmCd=1-1-5-1-0";

    const pdfs = parsePdfLinks(html, baseUrl);

    expect(pdfs).toHaveLength(3);
    expect(pdfs[0]!.pdfUrl).toContain("1.pdf");
    expect(pdfs[1]!.pdfUrl).toContain("2.pdf");
    expect(pdfs[2]!.pdfUrl).toContain("3.pdf");
  });

  it("月日形式のファイル名も抽出する", () => {
    const html = `
      <a href="/cmsfiles/contents/0000001/1289/9.13.pdf">9月13日本会議</a>
      <a href="/cmsfiles/contents/0000001/1289/11.15.pdf">11月15日本会議</a>
    `;
    const baseUrl = "https://www.town.takatori.nara.jp/contents_detail.php?co=cat&frmId=1289&frmCd=1-1-5-1-0";

    const pdfs = parsePdfLinks(html, baseUrl);

    expect(pdfs).toHaveLength(2);
    expect(pdfs[0]!.pdfUrl).toContain("9.13.pdf");
    expect(pdfs[1]!.pdfUrl).toContain("11.15.pdf");
  });

  it("重複した PDF URL は除外する", () => {
    const html = `
      <a href="/cmsfiles/contents/0000002/2539/1.pdf">会議録</a>
      <a href="/cmsfiles/contents/0000002/2539/1.pdf">会議録（再掲）</a>
    `;
    const baseUrl = "https://www.town.takatori.nara.jp/contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0";

    const pdfs = parsePdfLinks(html, baseUrl);
    expect(pdfs).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    const pdfs = parsePdfLinks("", "https://www.town.takatori.nara.jp/");
    expect(pdfs).toHaveLength(0);
  });
});
