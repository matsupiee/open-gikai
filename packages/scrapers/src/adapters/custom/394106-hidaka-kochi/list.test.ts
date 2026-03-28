import { describe, expect, it } from "vitest";
import { parseIssueNumber, parseListPage } from "./list";

describe("parseIssueNumber", () => {
  it("議会だより第198号 から号数を抽出する", () => {
    expect(parseIssueNumber("議会だより第198号（令和7年4月30日）")).toBe(198);
  });

  it("第201号 のような空白付きにも対応する", () => {
    expect(parseIssueNumber("議会だより 第 201 号")).toBe(201);
  });

  it("号数がない場合は null を返す", () => {
    expect(parseIssueNumber("議会だより")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("現行ページ形式の PDF リンクを抽出する", () => {
    const html = `
      <div class="text-area">
        <pre><a href="https://www.vill.hidaka.kochi.jp/kurashi/files/20254251337.pdf">議会だより第198号</a>（令和7年4月30日）</pre>
        <pre><a href="https://www.vill.hidaka.kochi.jp/kurashi/files/2025815144211.pdf">議会だより第199号</a>（令和7年7月31日）</pre>
      </div>
    `;

    const issues = parseListPage(html);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual({
      pdfUrl: "https://www.vill.hidaka.kochi.jp/kurashi/files/20254251337.pdf",
      title: "日高村議会だより 第198号",
      heldOn: "2025-04-30",
      issueNumber: 198,
    });
    expect(issues[1]!.heldOn).toBe("2025-07-31");
  });

  it("過去ページ形式の相対リンクも抽出する", () => {
    const html = `
      <div class="text-area">
        <a href="/kurashi/files/201911279047.pdf" target="_blank">議会だより第176号（令和元年10月31日発行）</a>
        <a href="/kurashi/files/20197214126.pdf" target="_blank">議会だより第174号（平成31年4月30日発行）</a>
      </div>
    `;

    const issues = parseListPage(html);

    expect(issues).toHaveLength(2);
    expect(issues[0]!.pdfUrl).toBe(
      "https://www.vill.hidaka.kochi.jp/kurashi/files/201911279047.pdf"
    );
    expect(issues[0]!.heldOn).toBe("2019-10-31");
    expect(issues[1]!.heldOn).toBe("2019-04-30");
  });

  it("重複リンクは除外する", () => {
    const html = `
      <div>
        <a href="/kurashi/files/dup.pdf">議会だより第198号</a>（令和7年4月30日）
        <a href="/kurashi/files/dup.pdf">議会だより第198号</a>（令和7年4月30日）
      </div>
    `;

    const issues = parseListPage(html);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.issueNumber).toBe(198);
  });
});
