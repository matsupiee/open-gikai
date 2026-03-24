import { describe, expect, it } from "vitest";
import { parsePdfLinks } from "./list";

describe("parsePdfLinks", () => {
  it("令和年代の定例会 PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <ul>
          <li>
            <a href="/upload/file/09gikai/01gikai/%E4%BB%A4%E5%92%8C7%E5%B9%B49%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">
              令和7年9月定例会
            </a>
          </li>
          <li>
            <a href="/upload/file/09gikai/01gikai/%E4%BB%A4%E5%92%8C7%E5%B9%B43%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">
              令和7年3月定例会
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toContain("/upload/file/09gikai/01gikai/");
    expect(meetings[0]!.heldOn).toBe("2025-09-01");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.heldOn).toBe("2025-03-01");
    expect(meetings[1]!.meetingType).toBe("plenary");
  });

  it("臨時会を extraordinary として分類する", () => {
    const html = `
      <ul>
        <li>
          <a href="/upload/file/09gikai/01gikai/%E4%BB%A4%E5%92%8C7%E5%B9%B41%E6%9C%88%E8%87%A8%E6%99%82%E4%BC%9A%E3%83%BC3%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">
            令和7年1月臨時会ー3月定例会
          </a>
        </li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2025-01-01");
  });

  it("平成年代の PDF リンクを抽出する（別ディレクトリ）", () => {
    const html = `
      <ul>
        <li>
          <a href="/upload/file/09gikai/02_%E4%BC%9A%E8%AD%B0%E9%8C%B2/H20/%E5%B9%B3%E6%88%9020%E5%B9%B49%E6%9C%88%E8%87%A8%E6%99%82%E4%BC%9A%EF%BC%8D9%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">
            平成20年9月臨時会－9月定例会
          </a>
        </li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2008-09-01");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parsePdfLinks(html);
    expect(meetings).toHaveLength(0);
  });

  it("/upload/file/09gikai/ 以外の PDF リンクは無視する", () => {
    const html = `
      <ul>
        <li><a href="/other/path/file.pdf">関係ないリンク</a></li>
        <li>
          <a href="/upload/file/09gikai/01gikai/%E4%BB%A4%E5%92%8C6%E5%B9%B46%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">
            令和6年6月定例会
          </a>
        </li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-06-01");
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <ul>
        <li>
          <a href="/upload/file/09gikai/01gikai/%E4%BB%A4%E5%92%8C%E5%85%83%E5%B9%B46%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">
            令和元年6月定例会
          </a>
        </li>
      </ul>
    `;

    const meetings = parsePdfLinks(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-01");
  });
});
