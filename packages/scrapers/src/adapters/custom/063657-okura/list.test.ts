import { describe, it, expect } from "vitest";
import {
  parseListPage,
} from "./list";

describe("parseListPage", () => {
  it("material/files/group/9/ 配下の PDF リンクを抽出する（プロトコル相対 URL）", () => {
    const html = `
      <ul>
        <li><a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei12gatsu.pdf">定例会12月（R6teirei12gatsu.pdf）</a></li>
        <li><a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei9gatsu.pdf">定例会9月（R6teirei9gatsu.pdf）</a></li>
        <li><a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6rinji5gatsu.pdf">臨時会5月（R6rinji5gatsu.pdf）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei12gatsu.pdf"
    );
    expect(meetings[0]!.title).toBe("令和6年定例会12月");
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
    expect(meetings[0]!.meetingKind).toBe("teirei");
  });

  it("臨時会のリンクを正しく抽出する", () => {
    const html = `
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6rinji5gatsu.pdf">臨時会5月</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年臨時会5月");
    expect(meetings[0]!.heldOn).toBe("2024-05-01");
    expect(meetings[0]!.meetingKind).toBe("rinji");
  });

  it("対象年以外の PDF リンクはスキップする", () => {
    const html = `
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R7teirei3gatsu.pdf">定例会3月</a>
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei12gatsu.pdf">定例会12月</a>
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R5teirei6gatsu.pdf">定例会6月</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
  });

  it("material/files/group/9/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <a href="/other/files/R6teirei3gatsu.pdf">他のPDF</a>
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei3gatsu.pdf">定例会3月</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年定例会3月");
  });

  it("認識できないファイル名はスキップする", () => {
    const html = `
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei12gatsu.pdf">定例会12月</a>
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/unknown-file.pdf">不明なファイル</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
  });

  it("結果を新しい順（降順）でソートする", () => {
    const html = `
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei3gatsu.pdf">定例会3月</a>
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei12gatsu.pdf">定例会12月</a>
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei6gatsu.pdf">定例会6月</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
    expect(meetings[1]!.heldOn).toBe("2024-06-01");
    expect(meetings[2]!.heldOn).toBe("2024-03-01");
  });

  it("令和7年（2025年）の PDF を正しくパースする", () => {
    const html = `
      <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R7teirei3gatsu.pdf">定例会3月</a>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年定例会3月");
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
  });

  it("PDF リンクが1件もない場合は空配列を返す", () => {
    const html = `<p>会議録はありません。</p>`;
    const meetings = parseListPage(html, 2024);
    expect(meetings).toEqual([]);
  });
});
