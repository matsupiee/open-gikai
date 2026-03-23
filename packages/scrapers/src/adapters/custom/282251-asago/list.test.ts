import { describe, expect, it } from "vitest";
import {
  buildYearLabel,
  extractComboItems,
  extractHeldOn,
} from "./shared";

describe("buildYearLabel", () => {
  it("2024年を令和6年に変換する", () => {
    expect(buildYearLabel(2024)).toBe("2024(令和６年)");
  });

  it("2019年は平成31年と令和元年の併記", () => {
    expect(buildYearLabel(2019)).toBe("2019(平成31年、令和元年)");
  });

  it("2018年を平成30年に変換する", () => {
    expect(buildYearLabel(2018)).toBe("2018(平成30年)");
  });

  it("2005年を平成17年に変換する", () => {
    expect(buildYearLabel(2005)).toBe("2005(平成17年)");
  });

  it("2025年を令和7年に変換する", () => {
    expect(buildYearLabel(2025)).toBe("2025(令和７年)");
  });
});

describe("extractComboItems", () => {
  it("コンボボックスの itemsValue を抽出する", () => {
    const html = `
      ASPx.createControl(ASPxClientComboBox,'ASPxPageControl_ASPxComboBKind','',
        {'autoPostBack':true,'uniqueID':'ASPxPageControl$ASPxComboBKind',
         'itemsValue':['本会議','委員会']});
    `;

    const items = extractComboItems(html, "ASPxComboBKind");
    expect(items).toEqual(["本会議", "委員会"]);
  });

  it("開催回次の itemsValue を抽出する", () => {
    const html = `
      ASPx.createControl(ASPxClientListBox,'ASPxPageControl_ASPxComboBKaisuL_DDD_L','',
        {'uniqueID':'ASPxPageControl$ASPxComboBKaisuL$DDD$L',
         'itemsValue':['第16回(１月臨時会)','第17回(３月定例会)','第18回(６月定例会)']});
    `;

    const items = extractComboItems(html, "ASPxComboBKaisuL");
    expect(items).toEqual([
      "第16回(１月臨時会)",
      "第17回(３月定例会)",
      "第18回(６月定例会)",
    ]);
  });

  it("マッチしない場合は空配列を返す", () => {
    const html = `<html><body>No combo boxes</body></html>`;
    const items = extractComboItems(html, "ASPxComboBKind");
    expect(items).toEqual([]);
  });
});

describe("extractHeldOn", () => {
  it("本会議の会議名から開催日を抽出する", () => {
    expect(
      extractHeldOn(
        "令和６年 第17回（定例）朝来市議会会議録（第１日：令和６年２月29日）",
      ),
    ).toBe("2024-02-29");
  });

  it("委員会の会議名から開催日を抽出する", () => {
    expect(
      extractHeldOn(
        "令和６年 朝来市議会総務常任委員会会議録（令和６年３月15日）",
      ),
    ).toBe("2024-03-15");
  });

  it("日付が見つからない場合は null を返す", () => {
    expect(extractHeldOn("会議名のみ")).toBeNull();
  });

  it("複数の日付がある場合は最後の日付を返す", () => {
    expect(
      extractHeldOn(
        "令和６年 第17回（定例）朝来市議会会議録（第３日：令和６年３月７日）",
      ),
    ).toBe("2024-03-07");
  });
});
