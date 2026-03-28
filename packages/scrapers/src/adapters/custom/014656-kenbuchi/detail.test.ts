import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildStatements, extractHeldOn, parseBills } from "./detail";

describe("extractHeldOn", () => {
  it("複数日の表記から最初の開催日を返す", () => {
    expect(extractHeldOn(2024, "2月29日、3月15日")).toBe("2024-02-29");
  });

  it("全角数字も解釈できる", () => {
    expect(extractHeldOn(2025, "４月14日")).toBe("2025-04-14");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOn(2025, "日程未定")).toBeNull();
  });
});

describe("parseBills", () => {
  it("unpdf の抽出結果から議案一覧を抽出する", () => {
    const text = `
      1 令和７年第１回町議会定例会議決結果 議 案 番 号 件 名 議 決 年 月 日 議決結果
      議 案 第 １ 号 刑法等の一部を改正する法律の施行に 伴う関係条例の整理に関する条例につ いて 令和７年３月３日 原案可決
      議 案 第 17 号 剣淵町固定資産評価審査委員会委員の 選任について 令和７年３月３日 同 意
      報 告 第 18 号 専決処分について 令和７年３月３日 承 認
      2 議 案 第 10 号 令和７年度剣淵町一般会計予算につい て 令和７年３月 18 日 原案可決
      議 案 第 10 号 令和７年度剣淵町一般会計予算につい て 令和７年３月 18 日 原案可決
    `;

    const result = parseBills(text);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      identifier: "議案第1号",
      title: "刑法等の一部を改正する法律の施行に伴う関係条例の整理に関する条例について",
      result: "原案可決",
      resolvedOn: "2025-03-03",
    });
    expect(result[1]).toEqual({
      identifier: "議案第17号",
      title: "剣淵町固定資産評価審査委員会委員の選任について",
      result: "同意",
      resolvedOn: "2025-03-03",
    });
    expect(result[2]).toEqual({
      identifier: "報告第18号",
      title: "専決処分について",
      result: "承認",
      resolvedOn: "2025-03-03",
    });
    expect(result[3]?.identifier).toBe("議案第10号");
  });

  it("議案がなければ空配列を返す", () => {
    expect(parseBills("令和７年第１回町議会定例会議決結果")).toEqual([]);
  });
});

describe("buildStatements", () => {
  it("議案一覧を remark statement に変換する", () => {
    const statements = buildStatements([
      {
        identifier: "議案第1号",
        title: "条例改正について",
        result: "原案可決",
        resolvedOn: "2025-03-03",
      },
      {
        identifier: "報告第2号",
        title: "専決処分について",
        result: "承認",
        resolvedOn: "2025-03-03",
      },
    ]);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatchObject({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content: "議案第1号 条例改正について 原案可決",
      contentHash: createHash("sha256").update("議案第1号 条例改正について 原案可決").digest("hex"),
      startOffset: 0,
      endOffset: "議案第1号 条例改正について 原案可決".length,
    });
    expect(statements[1]?.startOffset).toBe(statements[0]!.endOffset + 1);
  });
});
