import { describe, it, expect } from "vitest";
import { parseLinkText, parseListPage, buildExternalId } from "./list";

describe("parseLinkText", () => {
  it("令和8年第1回臨時会を正しくパースする", () => {
    const result = parseLinkText("令和８年第１回設楽町議会臨時会会議録");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("臨時会");
    expect(result!.dayInSession).toBeNull();
  });

  it("令和7年第1回定例会第1日を正しくパースする", () => {
    const result = parseLinkText("令和７年第１回定例会第１日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.dayInSession).toBe(1);
  });

  it("令和6年第1回定例会第1日を正しくパースする", () => {
    const result = parseLinkText("令和６年第１回定例会第１日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.dayInSession).toBe(1);
  });

  it("定例会第2日を正しくパースする", () => {
    const result = parseLinkText("令和６年第２回定例会第２日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.session).toBe(2);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.dayInSession).toBe(2);
  });

  it("平成25年の定例会を正しくパースする", () => {
    const result = parseLinkText("平成２５年第１回定例会第１日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2013);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("令和元年を正しくパースする", () => {
    const result = parseLinkText("令和元年第２回定例会第１日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.session).toBe(2);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("半角数字の年も正しくパースする", () => {
    const result = parseLinkText("令和7年第1回定例会第1日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.session).toBe(1);
  });

  it("会議情報のないテキストは null を返す", () => {
    const result = parseLinkText("設楽町議会会議録一覧");
    expect(result).toBeNull();
  });

  it("関係のないリンクテキストは null を返す", () => {
    const result = parseLinkText("設楽町議会の概要について");
    expect(result).toBeNull();
  });

  it("年が省略されたリンクテキストは year: null を返す", () => {
    const result = parseLinkText("第1回臨時会会議録（2月17日）");
    expect(result).not.toBeNull();
    expect(result!.year).toBeNull();
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("臨時会");
  });

  it("年が省略された定例会リンクテキストは year: null を返す", () => {
    const result = parseLinkText("第３回定例会第２日");
    expect(result).not.toBeNull();
    expect(result!.year).toBeNull();
    expect(result!.session).toBe(3);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.dayInSession).toBe(2);
  });
});

describe("buildExternalId", () => {
  it("添付ファイル ID から externalId を生成する", () => {
    expect(buildExternalId("https://www.town.shitara.lg.jp/uploaded/attachment/4804.pdf")).toBe("shitara_4804");
  });

  it("相対パス形式でも正しく処理する", () => {
    expect(buildExternalId("/uploaded/attachment/3516.pdf")).toBe("shitara_3516");
  });

  it("対応しない URL は null を返す", () => {
    expect(buildExternalId("https://example.com/other.pdf")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("指定年の PDF リンクを正しく抽出する", () => {
    const html = `
      <html><body>
      <h2>令和8年</h2>
      <p><a href="/uploaded/attachment/4804.pdf">令和８年第１回設楽町議会臨時会会議録</a></p>
      <h2>令和7年</h2>
      <p><a href="/uploaded/attachment/4363.pdf">令和７年第１回定例会第１日</a></p>
      <p><a href="/uploaded/attachment/4364.pdf">令和７年第１回定例会第２日</a></p>
      <h2>令和6年</h2>
      <p><a href="/uploaded/attachment/3516.pdf">令和６年第１回定例会第１日</a></p>
      </body></html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shitara.lg.jp/uploaded/attachment/4363.pdf"
    );
    expect(meetings[0]!.title).toBe("令和7年第1回定例会第1日");
    expect(meetings[0]!.meetingKind).toBe("定例会");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.shitara.lg.jp/uploaded/attachment/4364.pdf"
    );
    expect(meetings[1]!.title).toBe("令和7年第1回定例会第2日");
  });

  it("令和8年の臨時会を抽出する", () => {
    const html = `
      <html><body>
      <p><a href="/uploaded/attachment/4804.pdf">令和８年第１回設楽町議会臨時会会議録</a></p>
      <p><a href="/uploaded/attachment/4363.pdf">令和７年第１回定例会第１日</a></p>
      </body></html>
    `;

    const meetings = parseListPage(html, 2026);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shitara.lg.jp/uploaded/attachment/4804.pdf"
    );
    expect(meetings[0]!.meetingKind).toBe("臨時会");
    expect(meetings[0]!.title).toBe("令和8年第1回臨時会");
  });

  it("他の年のリンクをスキップする", () => {
    const html = `
      <p><a href="/uploaded/attachment/4804.pdf">令和８年第１回設楽町議会臨時会会議録</a></p>
      <p><a href="/uploaded/attachment/4363.pdf">令和７年第１回定例会第１日</a></p>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(0);
  });

  it("重複する href を除外する", () => {
    const html = `
      <p><a href="/uploaded/attachment/4363.pdf">令和７年第１回定例会第１日</a></p>
      <p><a href="/uploaded/attachment/4363.pdf">令和７年第１回定例会第１日</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL のリンクはそのまま使用する", () => {
    const html = `
      <p><a href="https://www.town.shitara.lg.jp/uploaded/attachment/4363.pdf">令和７年第１回定例会第１日</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shitara.lg.jp/uploaded/attachment/4363.pdf"
    );
  });

  it("<h2> 見出しの年をリンクテキストが年なしのリンクに補完する", () => {
    const html = `
      <html><body>
      <h2>令和３年</h2>
      <p><a href="/uploaded/attachment/3000.pdf">第１回臨時会会議録（2月17日）</a></p>
      <p><a href="/uploaded/attachment/3001.pdf">第２回定例会第１日</a></p>
      </body></html>
    `;

    const meetings = parseListPage(html, 2021);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shitara.lg.jp/uploaded/attachment/3000.pdf"
    );
    expect(meetings[0]!.title).toBe("令和3年第1回臨時会");
    expect(meetings[0]!.meetingKind).toBe("臨時会");
    expect(meetings[1]!.title).toBe("令和3年第2回定例会第1日");
  });

  it("見出しとリンク混在: 見出しの年と異なる年はスキップする", () => {
    const html = `
      <html><body>
      <h2>令和４年</h2>
      <p><a href="/uploaded/attachment/3100.pdf">第１回臨時会会議録</a></p>
      <h2>令和３年</h2>
      <p><a href="/uploaded/attachment/3000.pdf">第１回臨時会会議録</a></p>
      </body></html>
    `;

    const meetings = parseListPage(html, 2021);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.shitara.lg.jp/uploaded/attachment/3000.pdf"
    );
    expect(meetings[0]!.title).toBe("令和3年第1回臨時会");
  });
});
