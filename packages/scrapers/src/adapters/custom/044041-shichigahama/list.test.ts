import { describe, it, expect } from "vitest";
import { parseListPage, extractHeldOnFromTitle } from "./list";

describe("parseListPage", () => {
  it("指定年の会議録 PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年定例会等会議録</h2>
      <ul>
        <li><a href="../../benricho/joho/assets/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E5%AE%9A%E4%BE%8B%E4%BC%9A12%E6%9C%88%E4%BC%9A%E8%AD%B0.pdf">令和6年定例会12月会議.pdf</a></li>
        <li><a href="../../benricho/joho/assets/%E4%BB%A4%E5%92%8C6%E5%B9%B4%E5%AE%9A%E4%BE%8B%E4%BC%9A9%E6%9C%88%E4%BC%9A%E8%AD%B0.pdf">令和6年定例会9月会議.pdf</a></li>
      </ul>
      <h2>令和5年定例会等会議録</h2>
      <ul>
        <li><a href="../../benricho/joho/assets/%E4%BB%A4%E5%92%8C5%E5%B9%B4%E5%AE%9A%E4%BE%8B%E4%BC%9A12%E6%9C%88%E4%BC%9A%E8%AD%B0.pdf">令和5年定例会12月会議.pdf</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("令和6年定例会12月会議");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.heldOn).toBe("2024-12-01");

    expect(meetings[1]!.title).toBe("令和6年定例会9月会議");
    expect(meetings[1]!.heldOn).toBe("2024-09-01");
  });

  it("予算審査特別委員会は committee として分類される", () => {
    const html = `
      <h2>令和6年定例会等会議録</h2>
      <ul>
        <li><a href="/benricho/joho/assets/r6yosan.pdf">令和6年予算審査特別委員会.pdf</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
    expect(meetings[0]!.title).toBe("令和6年予算審査特別委員会");
  });

  it("対象年と異なるブロックはスキップする", () => {
    const html = `
      <h2>令和7年定例会等会議録</h2>
      <ul>
        <li><a href="/benricho/joho/assets/r7.pdf">令和7年定例会6月会議.pdf</a></li>
      </ul>
      <h2>令和6年定例会等会議録</h2>
      <ul>
        <li><a href="/benricho/joho/assets/r6.pdf">令和6年定例会12月会議.pdf</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年定例会12月会議");
  });

  it("対象年が存在しない場合は空配列を返す", () => {
    const html = `
      <h2>令和5年定例会等会議録</h2>
      <ul>
        <li><a href="/benricho/joho/assets/r5.pdf">令和5年定例会12月会議.pdf</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <h2>令和元年定例会等会議録</h2>
      <ul>
        <li><a href="/benricho/joho/assets/r1.pdf">令和元年定例会6月会議.pdf</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-01");
  });

  it("絶対 URL の PDF リンクも正しく処理する", () => {
    const html = `
      <h2>令和6年定例会等会議録</h2>
      <ul>
        <li><a href="https://www.shichigahama.com/benricho/joho/assets/r6.pdf">令和6年定例会3月会議.pdf</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.shichigahama.com/benricho/joho/assets/r6.pdf"
    );
  });

  it("副本付きのリンクも取得できる", () => {
    const html = `
      <h2>令和6年定例会等会議録</h2>
      <ul>
        <li><a href="/benricho/joho/assets/r6_3.pdf">令和6年定例会3月会議（副本）.pdf</a></li>
      </ul>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年定例会3月会議（副本）");
  });
});

describe("extractHeldOnFromTitle", () => {
  it("月を含むタイトルから開催日を推測する", () => {
    expect(extractHeldOnFromTitle("令和6年定例会6月会議", 2024)).toBe("2024-06-01");
    expect(extractHeldOnFromTitle("令和6年定例会12月会議", 2024)).toBe("2024-12-01");
  });

  it("月が含まれない場合は null を返す", () => {
    expect(extractHeldOnFromTitle("令和6年予算審査特別委員会", 2024)).toBeNull();
  });

  it("1桁の月もパディングされる", () => {
    expect(extractHeldOnFromTitle("令和6年定例会1月会議", 2024)).toBe("2024-01-01");
  });
});
