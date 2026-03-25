import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("h2 年度と file_contents リンクからメタ情報を抽出する", () => {
    const html = `
      <h2>令和7年</h2>
      <p><a href="file_contents/361R7.docx">3月6日（第1号）R7</a></p>
      <p><a href="file_contents/2R7.docx">第2回定例会（会期日程・議決の結果）R7</a></p>
    `;

    const meetings = parseListPage(html);

    // 会期日程はスキップされる
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.fileUrl).toBe(
      "https://www.town.motobu.okinawa.jp/doc/2023103100062/file_contents/361R7.docx",
    );
    expect(meetings[0]!.fileType).toBe("docx");
    expect(meetings[0]!.title).toBe("3月6日（第1号）R7");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.heldOn).toBe("2025-03-06");
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("複数年度を正しく処理する", () => {
    const html = `
      <h2>令和6年</h2>
      <p><a href="file_contents/76131.docx">6月13日（第1号）</a></p>
      <h2>令和5年</h2>
      <p><a href="file_contents/r51214.pdf">12月14日（第4号）</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.fileType).toBe("docx");
    expect(meetings[1]!.year).toBe(2023);
    expect(meetings[1]!.fileType).toBe("pdf");
  });

  it("臨時会を correctly 検出する", () => {
    const html = `
      <h2>令和7年</h2>
      <p><a href="file_contents/219R7.docx">2月19日（1回臨）R7</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("委員会を correctly 検出する", () => {
    const html = `
      <h2>令和6年</h2>
      <p><a href="file_contents/yoi1.pdf">■令和6年9月20日（決委第2号）</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
  });

  it("目次・通告書をスキップする", () => {
    const html = `
      <h2>令和7年</h2>
      <p><a href="file_contents/toc.docx">目次・通告書（R7．3月合併号）</a></p>
      <p><a href="file_contents/361R7.docx">3月6日（第1号）R7</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("3月6日（第1号）R7");
  });

  it("議決の結果を含むリンクをスキップする", () => {
    const html = `
      <h2>令和7年</h2>
      <p><a href="file_contents/2R7.docx">第2回定例会（会期日程・議決の結果）R7</a></p>
      <p><a href="file_contents/313R7.docx">3月13日（第3号）一般質問R7</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("3月13日（第3号）一般質問R7");
  });

  it("平成の年度を正しくパースする", () => {
    const html = `
      <h2>平成30年</h2>
      <p><a href="file_contents/h300309.pdf">3月9日（第1号）</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2018);
  });

  it("令和元年を正しくパースする", () => {
    const html = `
      <h2>平成31年・令和元年</h2>
      <p><a href="file_contents/r11212.pdf">12月12日（第4号）</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2019);
  });

  it("リンクテキストに年付き日付パターンを正しくパースする", () => {
    const html = `
      <h2>令和7年</h2>
      <p><a href="file_contents/325R7.docx">令和7年3月25日（3回臨）</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-25");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("file_contents 以外のリンクを無視する", () => {
    const html = `
      <h2>令和7年</h2>
      <p><a href="/other/page.pdf">関係ないリンク</a></p>
      <p><a href="file_contents/361R7.docx">3月6日（第1号）R7</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
  });

  it("リンクが一件もない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});
