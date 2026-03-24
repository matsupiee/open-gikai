import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("会議録リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="//www.vill.mitsue.nara.jp/material/files/group/16/R5-3kaigiroku.pdf">令和5年第1回定例会会議録</a></li>
        <li><a href="//www.vill.mitsue.nara.jp/material/files/group/16/R5-3giketukekka.pdf">令和5年第1回定例会議決結果</a></li>
        <li><a href="//www.vill.mitsue.nara.jp/material/files/group/16/R5-6kaigiroku.pdf">令和5年第2回定例会会議録</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和5年第1回定例会会議録");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.mitsue.nara.jp/material/files/group/16/R5-3kaigiroku.pdf"
    );
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[1]!.title).toBe("令和5年第2回定例会会議録");
  });

  it("議決結果リンクは除外する", () => {
    const html = `
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/3/R4-12kaigiroku.pdf">令和4年第4回定例会会議録</a></li>
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/3/R4-12giketukekka.pdf">令和4年第4回定例会議決結果</a></li>
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/3/R4-12giketsukekka.pdf">令和4年第4回定例会議決結果（別）</a></li>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和4年第4回定例会会議録");
  });

  it("会議録テキストを含まないリンクはスキップする", () => {
    const html = `
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/1/somefile.pdf">お知らせ資料</a></li>
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/1/R7-3kaigiroku.pdf">令和7年第1回定例会会議録</a></li>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年第1回定例会会議録");
  });

  it("プロトコル相対 URL を https: に正規化する", () => {
    const html = `
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/1/R7dai4kaiteireikaikaigiroku.pdf">令和7年第4回定例会会議録</a></li>
    `;

    const meetings = parseListPage(html);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.mitsue.nara.jp/material/files/group/1/R7dai4kaiteireikaikaigiroku.pdf"
    );
  });

  it("臨時会の会議録も抽出する", () => {
    const html = `
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/1/2912ka.pdf">平成29年5月臨時会会議録</a></li>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("平成29年5月臨時会会議録");
  });

  it("HTML が空の場合は空配列を返す", () => {
    const meetings = parseListPage("");
    expect(meetings).toHaveLength(0);
  });

  it("group/1、group/3、group/16 の URL も正規化する", () => {
    const html = `
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/1/H3103teireikaikaigiroku.pdf">平成31年第1回定例会会議録</a></li>
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/3/0209teireikaigijuroku.pdf">令和2年第1回定例会会議録</a></li>
      <li><a href="//www.vill.mitsue.nara.jp/material/files/group/16/R5-3kaigiroku.pdf">令和5年第1回定例会会議録</a></li>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toContain("group/1");
    expect(meetings[1]!.pdfUrl).toContain("group/3");
    expect(meetings[2]!.pdfUrl).toContain("group/16");
  });
});
