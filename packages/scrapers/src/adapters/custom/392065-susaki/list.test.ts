import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("本会議（3000）の詳細ページリンクを抽出する", () => {
    const html = `
      <a href="./giji_dtl.php?hdnKatugi=3000&hdnID=489">
        第491回11月臨時会・第492回11月臨時会・第493回12月定例会
      </a>
      <a href="./giji_dtl.php?hdnKatugi=3000&hdnID=482">
        第490回9月定例会
      </a>
    `;

    const items = parseListPage(html, "3000");

    expect(items).toHaveLength(2);
    expect(items[0]!.hdnId).toBe("489");
    expect(items[0]!.category).toBe("3000");
    expect(items[0]!.meetingName).toBe("第491回11月臨時会・第492回11月臨時会・第493回12月定例会");
    expect(items[0]!.detailUrl).toBe(
      "https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=3000&hdnID=489"
    );
    expect(items[1]!.hdnId).toBe("482");
    expect(items[1]!.meetingName).toBe("第490回9月定例会");
  });

  it("委員会（4000）のリンクを抽出する", () => {
    const html = `
      <a href="./giji_dtl.php?hdnKatugi=4000&hdnID=461">
        第486回12月定例会
      </a>
    `;

    const items = parseListPage(html, "4000");

    expect(items).toHaveLength(1);
    expect(items[0]!.category).toBe("4000");
    expect(items[0]!.hdnId).toBe("461");
  });

  it("カテゴリが異なるリンクは除外する", () => {
    const html = `
      <a href="./giji_dtl.php?hdnKatugi=3000&hdnID=489">本会議</a>
      <a href="./giji_dtl.php?hdnKatugi=4000&hdnID=461">委員会</a>
    `;

    const items3000 = parseListPage(html, "3000");
    const items4000 = parseListPage(html, "4000");

    expect(items3000).toHaveLength(1);
    expect(items3000[0]!.hdnId).toBe("489");
    expect(items4000).toHaveLength(1);
    expect(items4000[0]!.hdnId).toBe("461");
  });

  it("重複する hdnID を除外する", () => {
    const html = `
      <a href="./giji_dtl.php?hdnKatugi=3000&hdnID=489">第493回12月定例会</a>
      <a href="./giji_dtl.php?hdnKatugi=3000&hdnID=489">第493回12月定例会（再掲）</a>
    `;

    const items = parseListPage(html, "3000");

    expect(items).toHaveLength(1);
    expect(items[0]!.hdnId).toBe("489");
  });

  it("&amp; エンティティを含む href を正しく変換する", () => {
    const html = `
      <a href="./giji_dtl.php?hdnKatugi=3000&amp;hdnID=489">第493回12月定例会</a>
    `;

    const items = parseListPage(html, "3000");

    expect(items).toHaveLength(1);
    expect(items[0]!.detailUrl).toBe(
      "https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=3000&hdnID=489"
    );
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません。</p></div>`;

    const items = parseListPage(html, "3000");

    expect(items).toHaveLength(0);
  });

  it("会議名の空白を正規化する", () => {
    const html = `
      <a href="./giji_dtl.php?hdnKatugi=3000&hdnID=489">
        第491回&nbsp;11月臨時会
      </a>
    `;

    const items = parseListPage(html, "3000");

    expect(items[0]!.meetingName).toBe("第491回 11月臨時会");
  });
});
