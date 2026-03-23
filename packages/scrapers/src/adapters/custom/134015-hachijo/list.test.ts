import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("指定年の定例会 PDF リンクを抽出する", () => {
    const html = `
      <h3>令和7年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250101.pdf">（1号　R7.3.3）</a><br>
      <a href="pdf/kaigiroku/2025/20250102.pdf">（2号　R7.3.17）</a><br>
      <a href="pdf/kaigiroku/2025/20250103.pdf">（3号　R7.3.18）</a><br>
      <a href="pdf/kaigiroku/2025/20250104.pdf">（4号　R7.3.28）</a></p>
      <h3>令和6年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2024/20240101.pdf">（1号　R6.3.5）</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hachijo.tokyo.jp/kakuka/gikai/pdf/kaigiroku/2025/20250101.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2025-03-03");
    expect(meetings[0]!.title).toBe("第一回定例会 1号　R7.3.3");
    expect(meetings[0]!.session).toBe("第一回定例会会議録");

    expect(meetings[1]!.heldOn).toBe("2025-03-17");
    expect(meetings[2]!.heldOn).toBe("2025-03-18");
    expect(meetings[3]!.heldOn).toBe("2025-03-28");
  });

  it("臨時会の PDF リンクも抽出する", () => {
    const html = `
      <h3>令和7年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250101.pdf">（1号　R7.3.3）</a></p>
      <p><b>第一回臨時会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250701r.pdf">（1号　R7.7.1）</a></p>
      <h3>令和6年　会議録</h3>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[1]!.session).toBe("第一回臨時会会議録");
    expect(meetings[1]!.heldOn).toBe("2025-07-01");
    expect(meetings[1]!.pdfUrl).toContain("20250701r.pdf");
  });

  it("対象年以外のセクションは含めない", () => {
    const html = `
      <h3>令和7年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250101.pdf">（1号　R7.3.3）</a></p>
      <h3>令和6年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2024/20240101.pdf">（1号　R6.3.5）</a></p>
    `;

    const meetings2025 = parseListPage(html, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-03-03");

    const meetings2024 = parseListPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-03-05");
  });

  it("平成の年度を正しく処理する", () => {
    const html = `
      <h3>平成30年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2018/20180101.pdf">（1号　H30.3.1）</a></p>
    `;

    const meetings = parseListPage(html, 2018);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-03-01");
  });

  it("平成31年（令和元年）を正しく処理する", () => {
    const html = `
      <h3>平成31年（令和元年）　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2019/20190101.pdf">（1号　H31.3.1）</a></p>
      <p><b>第二回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2019/20190201.pdf">（1号　R1.6.11）</a></p>
    `;

    const meetings = parseListPage(html, 2019);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2019-03-01");
    expect(meetings[1]!.heldOn).toBe("2019-06-11");
  });

  it("号数なし臨時会リンクも日付を抽出する", () => {
    const html = `
      <h3>令和6年　会議録</h3>
      <p><b>第一回臨時会会議録</b></p>
      <p><a href="pdf/kaigiroku/2024/20240101r.pdf">（R6.5.14）</a></p>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-05-14");
  });

  it("存在しない年度は空配列を返す", () => {
    const html = `
      <h3>令和7年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250101.pdf">（1号　R7.3.3）</a></p>
    `;

    expect(parseListPage(html, 2010)).toEqual([]);
  });

  it("複数セッションを正しくマッピングする", () => {
    const html = `
      <h3>令和7年　会議録</h3>
      <p><b>第一回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250101.pdf">（1号　R7.3.3）</a></p>
      <p><b>第二回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250610.pdf">（1号　R7.6.10）</a></p>
      <p><b>第三回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20250905.pdf">（1号　R7.9.5）</a></p>
      <p><b>第四回定例会会議録</b></p>
      <p><a href="pdf/kaigiroku/2025/20251215.pdf">（1号　R7.12.15）</a></p>
      <h3>令和6年　会議録</h3>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.session).toBe("第一回定例会会議録");
    expect(meetings[1]!.session).toBe("第二回定例会会議録");
    expect(meetings[2]!.session).toBe("第三回定例会会議録");
    expect(meetings[3]!.session).toBe("第四回定例会会議録");
  });
});
