import { describe, expect, it } from "vitest";
import {
  parseMasterCouncilList,
  extractYearFromCouncilName,
  parseDetailTitle,
  parseDetailDate,
} from "./list";

describe("parseMasterCouncilList", () => {
  it("MasterCouncil チェックボックスから ID と会議名を取得する", () => {
    const html = `
      <li>
        <input type="hidden" name="data[Proceeding][MasterCouncil][107]" id="ProceedingMasterCouncil107_" value="0"/>
        <input type="checkbox" name="data[Proceeding][MasterCouncil][107]" value="107" style="display:none;" id="ProceedingMasterCouncil107"/>
      </li>
      <li>
        <a href="javascript:void(0);">出水市令和7年第3回定例会</a>
        <input type="hidden" name="data[Proceeding][MasterCouncil][106]" id="ProceedingMasterCouncil106_" value="0"/>
        <input type="checkbox" name="data[Proceeding][MasterCouncil][106]" value="106" style="display:none;" id="ProceedingMasterCouncil106"/>
      </li>
      <li>
        <a href="javascript:void(0);">出水市令和7年第2回定例会</a>
        <input type="hidden" name="data[Proceeding][MasterCouncil][105]" id="ProceedingMasterCouncil105_" value="0"/>
        <input type="checkbox" name="data[Proceeding][MasterCouncil][105]" value="105" style="display:none;" id="ProceedingMasterCouncil105"/>
      </li>
      <li>
        <a href="javascript:void(0);">出水市令和7年第1回定例会</a>
      </li>
    `;

    const result = parseMasterCouncilList(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.masterCouncilId).toBe(107);
    expect(result[0]!.councilName).toBe("出水市令和7年第3回定例会");
    expect(result[1]!.masterCouncilId).toBe(106);
    expect(result[1]!.councilName).toBe("出水市令和7年第2回定例会");
    expect(result[2]!.masterCouncilId).toBe(105);
    expect(result[2]!.councilName).toBe("出水市令和7年第1回定例会");
  });

  it("チェックボックスがない場合は空配列を返す", () => {
    const html = `<html><body><p>コンテンツなし</p></body></html>`;
    const result = parseMasterCouncilList(html);
    expect(result).toHaveLength(0);
  });
});

describe("extractYearFromCouncilName", () => {
  it("令和年号を西暦に変換する", () => {
    expect(extractYearFromCouncilName("出水市令和7年第4回定例会")).toBe(2025);
    expect(extractYearFromCouncilName("出水市令和6年第1回定例会")).toBe(2024);
    expect(extractYearFromCouncilName("出水市令和元年第4回定例会")).toBe(2019);
  });

  it("平成年号を西暦に変換する", () => {
    expect(extractYearFromCouncilName("出水市平成18年第1回定例会")).toBe(2006);
    expect(extractYearFromCouncilName("出水市平成31年第1回定例会")).toBe(2019);
  });

  it("年号がない場合は null を返す", () => {
    expect(extractYearFromCouncilName("出水市議会定例会")).toBeNull();
  });
});

describe("parseDetailTitle", () => {
  it("ページタイトルから会議名を取得する", () => {
    const html = `
      <html>
        <head>
          <title>出水市令和7年第4回定例会 第１日 | 議会議事録検索｜鹿児島県出水市 みんなでつくる活力都市</title>
        </head>
      </html>
    `;

    const result = parseDetailTitle(html);
    expect(result).toBe("出水市令和7年第4回定例会 第１日");
  });

  it("「お探しのページ」の場合は null を返す", () => {
    const html = `
      <html>
        <head>
          <title>お探しのページを表示できませんでした｜鹿児島県出水市</title>
        </head>
      </html>
    `;

    const result = parseDetailTitle(html);
    expect(result).toBeNull();
  });

  it("「出水市」を含まない場合は null を返す", () => {
    const html = `
      <html>
        <head>
          <title>別のページタイトル | サイト名</title>
        </head>
      </html>
    `;

    const result = parseDetailTitle(html);
    expect(result).toBeNull();
  });

  it("titleタグがない場合は null を返す", () => {
    const html = `<html><body>コンテンツ</body></html>`;
    expect(parseDetailTitle(html)).toBeNull();
  });
});

describe("parseDetailDate", () => {
  it("ヘッダーの p 要素から開催日を取得する（全角数字）", () => {
    // 実際のサイトは全角数字を使用する
    const html = `
      <p id="text_1">
        令和７年出水市議会第４回定例会会議録第１号
        ―――――――――――――――――――――
        令和７年11月21日
        ―――――――――――――――――――――
        会議の場所　出水市議会議場
      </p>
    `;

    const result = parseDetailDate(html);
    expect(result).toBe("2025-11-21");
  });

  it("平成年号の開催日を取得する", () => {
    const html = `
      <p id="text_1">
        平成18年出水市議会第1回定例会会議録
        平成18年6月29日
        出水市議会議場
      </p>
    `;

    const result = parseDetailDate(html);
    expect(result).toBe("2006-06-29");
  });

  it("text_ の id を持つ p 要素がない場合は null を返す", () => {
    const html = `<html><body><p>日付なし</p></body></html>`;
    expect(parseDetailDate(html)).toBeNull();
  });

  it("日付形式が解析できない場合は null を返す", () => {
    const html = `<p id="text_1">会議録ヘッダーだが日付なし</p>`;
    expect(parseDetailDate(html)).toBeNull();
  });
});
