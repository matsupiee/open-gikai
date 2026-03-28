import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("年度見出しごとに PDF リンクを抽出する", () => {
    const html = `
      <h2 class="head-title"><span class="bg"><span class="bg2">令和7年</span></span></h2>
      <div class="wysiwyg">
        <p>
          <a target="_blank" class="icon2" href="//www.town.fukuchi.lg.jp/material/files/group/2/R7T1.pdf">
            令和7年第1回定例会議事録(PDFファイ
          </a>
          <a target="_blank" class="icon2" href="//www.town.fukuchi.lg.jp/material/files/group/2/R7T1.pdf">
            ル:2.9MB
          </a>）
        </p>
        <p><a href="//www.town.fukuchi.lg.jp/material/files/group/2/R7T2.pdf">令和7年第2回定例会議事録(PDFファイル:2MB)</a></p>
      </div>
      <h2 class="head-title"><span class="bg"><span class="bg2">令和6年</span></span></h2>
      <div class="wysiwyg">
        <p><a href="//www.town.fukuchi.lg.jp/material/files/group/2/R6T1.pdf">令和6年第1回定例会議事録(PDFファイル:2.3MB)</a></p>
      </div>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]).toEqual({
      year: 2025,
      pdfUrl: "https://www.town.fukuchi.lg.jp/material/files/group/2/R7T1.pdf",
      title: "令和7年第1回定例会議事録",
      meetingType: "plenary",
    });
    expect(meetings[1]).toEqual({
      year: 2025,
      pdfUrl: "https://www.town.fukuchi.lg.jp/material/files/group/2/R7T2.pdf",
      title: "令和7年第2回定例会議事録",
      meetingType: "plenary",
    });
    expect(meetings[2]!.year).toBe(2024);
  });

  it("臨時会を extraordinary として判定する", () => {
    const html = `
      <h2 class="head-title"><span class="bg"><span class="bg2">令和5年</span></span></h2>
      <div class="wysiwyg">
        <p><a href="//www.town.fukuchi.lg.jp/material/files/group/2/R52R.pdf">令和5年第2回臨時会議事録(PDFファイル:449KB)</a></p>
      </div>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.title).toBe("令和5年第2回臨時会議事録");
  });

  it("PDF ではない段落や議事録以外は除外する", () => {
    const html = `
      <h2 class="head-title"><span class="bg"><span class="bg2">令和7年</span></span></h2>
      <div class="wysiwyg">
        <p><a href="/material/files/group/2/R7T1.pdf">令和7年第1回定例会議事録(PDFファイル:2.9MB)</a></p>
        <p><a href="/material/files/group/2/note.txt">メモ</a></p>
        <p><a href="/material/files/group/2/schedule.pdf">会期日程(PDFファイル:10KB)</a></p>
      </div>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.fukuchi.lg.jp/material/files/group/2/R7T1.pdf",
    );
  });
});
