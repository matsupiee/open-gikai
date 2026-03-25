import { describe, it, expect } from "vitest";
import {
  parseYearPageIds,
  parseYearPage,
  buildMeetingTitle,
  parseYearFromPageTitle,
} from "./list";

describe("parseYearPageIds", () => {
  it("年度別ページの hdnKey を抽出する", () => {
    const html = `
      <a href="https://www.town.sakawa.lg.jp/life/dtl.php?hdnKey=2925">令和7年</a>
      <a href="https://www.town.sakawa.lg.jp/life/dtl.php?hdnKey=2673">令和6年</a>
    `;

    const pageIds = parseYearPageIds(html);

    expect(pageIds).toHaveLength(2);
    expect(pageIds).toContain("2925");
    expect(pageIds).toContain("2673");
  });

  it("hdnKey=1076（一覧ページ自身）は除外する", () => {
    const html = `
      <a href="https://www.town.sakawa.lg.jp/life/dtl.php?hdnKey=1076">議事録一覧</a>
      <a href="https://www.town.sakawa.lg.jp/life/dtl.php?hdnKey=2925">令和7年</a>
    `;

    const pageIds = parseYearPageIds(html);

    expect(pageIds).toHaveLength(1);
    expect(pageIds).not.toContain("1076");
    expect(pageIds).toContain("2925");
  });

  it("重複する hdnKey を除外する", () => {
    const html = `
      <a href="dtl.php?hdnKey=2925">令和7年</a>
      <a href="dtl.php?hdnKey=2925">令和7年（再掲）</a>
    `;

    const pageIds = parseYearPageIds(html);

    expect(pageIds).toHaveLength(1);
    expect(pageIds[0]).toBe("2925");
  });

  it("dtl.php?hdnKey を含まない場合は空配列を返す", () => {
    const html = `<div><p>テキストのみ</p></div>`;

    const pageIds = parseYearPageIds(html);

    expect(pageIds).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("h3 見出しと PDF リンクを正しく関連付ける", () => {
    const html = `
      <h3>3月定例会</h3>
      <p class="icon-pdf"><a href="/file/?t=LD&amp;id=2673&amp;fid=16512" target="_blank">1日目（PDF：555KB）</a></p>
      <p class="icon-pdf"><a href="/file/?t=LD&amp;id=2673&amp;fid=16513" target="_blank">4日目（PDF：703KB）</a></p>
    `;

    const meetings = parseYearPage(html, "2673");

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.meetingName).toBe("3月定例会");
    expect(meetings[0]!.linkText).toBe("1日目（PDF：555KB）");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.sakawa.lg.jp/file/?t=LD&id=2673&fid=16512"
    );
    expect(meetings[0]!.pageId).toBe("2673");
    expect(meetings[0]!.fileId).toBe("16512");
    expect(meetings[1]!.meetingName).toBe("3月定例会");
    expect(meetings[1]!.linkText).toBe("4日目（PDF：703KB）");
  });

  it("複数の h3 見出しに対応する", () => {
    const html = `
      <h3>3月定例会</h3>
      <p class="icon-pdf"><a href="/file/?t=LD&amp;id=2673&amp;fid=16512" target="_blank">1日目（PDF：555KB）</a></p>
      <h3>第1回臨時会</h3>
      <p class="icon-pdf"><a href="/file/?t=LD&amp;id=2673&amp;fid=15795" target="_blank">第1回臨時会（PDF：277KB）</a></p>
    `;

    const meetings = parseYearPage(html, "2673");

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.meetingName).toBe("3月定例会");
    expect(meetings[1]!.meetingName).toBe("第1回臨時会");
  });

  it("リンクテキストの HTML タグを除去する", () => {
    const html = `
      <h3>3月定例会</h3>
      <p class="icon-pdf"><a href="/file/?t=LD&amp;id=2673&amp;fid=16512" target="_blank"><span>1日目（PDF：555KB）</span></a></p>
    `;

    const meetings = parseYearPage(html, "2673");

    expect(meetings[0]!.linkText).toBe("1日目（PDF：555KB）");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <h3>3月定例会</h3>
      <p class="icon-pdf"><a href="/file/?t=LD&amp;id=2673&amp;fid=16512" target="_blank">1日目</a></p>
      <p class="icon-pdf"><a href="/file/?t=LD&amp;id=2673&amp;fid=16512" target="_blank">1日目（再掲）</a></p>
    `;

    const meetings = parseYearPage(html, "2673");

    expect(meetings).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>議事録はありません。</p></div>`;

    const meetings = parseYearPage(html, "2673");

    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL の PDF リンクをそのまま返す", () => {
    const html = `
      <h3>3月定例会</h3>
      <a href="https://www.town.sakawa.lg.jp/file/?t=LD&id=2673&fid=16512" target="_blank">3月定例会</a>
    `;

    const meetings = parseYearPage(html, "2673");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.sakawa.lg.jp/file/?t=LD&id=2673&fid=16512"
    );
  });
});

describe("buildMeetingTitle", () => {
  it("会議名と日目情報を組み合わせる", () => {
    expect(buildMeetingTitle("3月定例会", "1日目（PDF：555KB）")).toBe("3月定例会 1日目");
  });

  it("PDF サイズ情報を除去する", () => {
    expect(buildMeetingTitle("3月定例会", "4日目（PDF：703KB）")).toBe("3月定例会 4日目");
  });

  it("臨時会はリンクテキストと同じ場合は会議名のみ返す", () => {
    expect(buildMeetingTitle("第1回臨時会", "第1回臨時会（PDF：277KB）")).toBe("第1回臨時会");
  });

  it("会議名が空の場合はリンクテキストをそのまま返す", () => {
    expect(buildMeetingTitle("", "1日目")).toBe("1日目");
  });

  it("会議名もリンクテキストも空の場合はデフォルトタイトルを返す", () => {
    expect(buildMeetingTitle("", "")).toBe("佐川町議会 会議録");
  });
});

describe("parseYearFromPageTitle", () => {
  it("令和6年（全角数字）を 2024 年に変換する", () => {
    expect(parseYearFromPageTitle("<h1>令和６年（議事録）</h1>")).toBe(2024);
  });

  it("令和7年（半角数字）を 2025 年に変換する", () => {
    expect(parseYearFromPageTitle("<h1>令和7年（議事録）</h1>")).toBe(2025);
  });

  it("平成30年を 2018 年に変換する", () => {
    expect(parseYearFromPageTitle("<h1>平成30年（議事録）</h1>")).toBe(2018);
  });

  it("令和元年を 2019 年に変換する", () => {
    expect(parseYearFromPageTitle("<h1>令和元年（議事録）</h1>")).toBe(2019);
  });

  it("年度情報がない場合は null を返す", () => {
    expect(parseYearFromPageTitle("<div>議事録一覧</div>")).toBeNull();
  });
});
