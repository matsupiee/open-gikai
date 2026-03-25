import { describe, it, expect } from "vitest";
import {
  extractMonthDay,
  buildHeldOn,
  parseListPage,
} from "./list";

describe("extractMonthDay", () => {
  it("半角数字の月日を抽出する", () => {
    expect(extractMonthDay("12月2日 (PDFファイル: 554.2KB)")).toEqual({
      month: 12,
      day: 2,
    });
  });

  it("全角数字の月日を抽出する", () => {
    expect(extractMonthDay("１２月２日 (PDFファイル: 580.8KB)")).toEqual({
      month: 12,
      day: 2,
    });
  });

  it("1桁の月日を抽出する", () => {
    expect(extractMonthDay("7月5日 (PDFファイル: 300KB)")).toEqual({
      month: 7,
      day: 5,
    });
  });

  it("月日が見つからない場合は null を返す", () => {
    expect(extractMonthDay("定例会")).toBeNull();
  });
});

describe("buildHeldOn", () => {
  it("令和7年12月定例会 + 12月2日 → 2025-12-02", () => {
    expect(buildHeldOn("令和7年12月定例会", "12月2日 (PDFファイル: 554.2KB)")).toBe("2025-12-02");
  });

  it("令和7年10月臨時会 + 10月23日 → 2025-10-23", () => {
    expect(buildHeldOn("令和7年10月臨時会", "10月23日 (PDFファイル: 479.7KB)")).toBe("2025-10-23");
  });

  it("平成30年7月臨時会 + 7月5日 → 2018-07-05", () => {
    expect(buildHeldOn("平成30年7月臨時会", "7月5日 (PDFファイル: 300KB)")).toBe("2018-07-05");
  });

  it("令和元年9月定例会 + 9月10日 → 2019-09-10", () => {
    expect(buildHeldOn("令和元年9月定例会", "9月10日 (PDFファイル: 400KB)")).toBe("2019-09-10");
  });

  it("会議名から年が取得できない場合は null を返す", () => {
    expect(buildHeldOn("不明な会議", "12月2日")).toBeNull();
  });

  it("リンクテキストから日付が取得できない場合は null を返す", () => {
    expect(buildHeldOn("令和7年12月定例会", "不明なテキスト")).toBeNull();
  });
});

const SAMPLE_LIST_HTML = `
<!DOCTYPE html>
<html>
<body>
<div class="free-layout-area">
  <div>
    <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年12月定例会</span></span></span></h2>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251223008.pdf">12月2日 (PDFファイル: 554.2KB)</a></p>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251223002.pdf">12月3日 (PDFファイル: 580.8KB)</a></p>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251223003.pdf">12月4日 (PDFファイル: 427.9KB)</a></p>

    <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年10月臨時会</span></span></span></h2>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251023001.pdf">10月23日 (PDFファイル: 479.7KB)</a></p>

    <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年12月定例会</span></span></span></h2>
    <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20241202001.pdf">12月2日 (PDFファイル: 500KB)</a></p>
  </div>
</div>
</body>
</html>
`;

describe("parseListPage", () => {
  it("令和7年12月定例会の3件を抽出する", () => {
    const result = parseListPage(SAMPLE_LIST_HTML);
    const dec2025 = result.filter((m) => m.sessionTitle === "令和7年12月定例会");
    expect(dec2025.length).toBe(3);
  });

  it("令和7年12月定例会の最初の会議の heldOn が正しい", () => {
    const result = parseListPage(SAMPLE_LIST_HTML);
    const first = result.find(
      (m) => m.sessionTitle === "令和7年12月定例会" && m.heldOn === "2025-12-02",
    );
    expect(first).not.toBeUndefined();
    expect(first!.meetingType).toBe("plenary");
  });

  it("臨時会の meetingType が extraordinary", () => {
    const result = parseListPage(SAMPLE_LIST_HTML);
    const rinji = result.find((m) => m.sessionTitle === "令和7年10月臨時会");
    expect(rinji).not.toBeUndefined();
    expect(rinji!.meetingType).toBe("extraordinary");
    expect(rinji!.heldOn).toBe("2025-10-23");
  });

  it("全件（5件）を抽出する", () => {
    const result = parseListPage(SAMPLE_LIST_HTML);
    expect(result.length).toBe(5);
  });

  it("PDF URL がプロトコル付きの絶対 URL になる", () => {
    const result = parseListPage(SAMPLE_LIST_HTML);
    for (const m of result) {
      expect(m.pdfUrl).toMatch(/^https:\/\//);
    }
  });

  it("タイトルに会議名と日付が含まれる", () => {
    const result = parseListPage(SAMPLE_LIST_HTML);
    const first = result[0]!;
    expect(first.title).toContain("令和7年12月定例会");
    expect(first.title).toContain("12月2日");
  });

  it("令和6年のデータが含まれる", () => {
    const result = parseListPage(SAMPLE_LIST_HTML);
    const r6 = result.find((m) => m.sessionTitle === "令和6年12月定例会");
    expect(r6).not.toBeUndefined();
    expect(r6!.heldOn).toBe("2024-12-02");
  });
});
