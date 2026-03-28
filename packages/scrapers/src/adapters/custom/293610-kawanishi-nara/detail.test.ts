import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOn,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("空白を含む議長表記を解析する", () => {
    const result = parseSpeaker("〇議 長（弓仲利博議員） おはようございます。");
    expect(result.speakerName).toBe("弓仲利博");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("番号付き議員表記を解析する", () => {
    const result = parseSpeaker(
      "〇１２番議員（芝 和也議員） はい、それでは若干お尋ねいたします。",
    );
    expect(result.speakerName).toBe("芝和也");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("はい、それでは若干お尋ねいたします。");
  });

  it("複合役職の理事表記を解析する", () => {
    const result = parseSpeaker(
      "〇まちづくり推進理事（乾井宏純） ただいま芝議員の方からご質問ありました。",
    );
    expect(result.speakerName).toBe("乾井宏純");
    expect(result.speakerRole).toBe("まちづくり推進理事");
  });

  it("氏名のない役職発言を解析する", () => {
    const result = parseSpeaker("〇町 長 それでは、ご説明いたします。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("それでは、ご説明いたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("理事は answer", () => {
    expect(classifyKind("理事")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("発言マーカーごとに statements を抽出する", () => {
    const text = `
      〇議 長（弓仲利博議員） おはようございます。
      これより令和６年川西町議会第１回定例会を開会いたします。
      〇町 長（小澤晃広） 皆様改めましておはようございます。
      本日ここに、令和６年川西町議会第１回定例会を開催いたしましたところ、
      〇１２番議員（芝 和也議員） はい、それでは若干お尋ねいたします。
      - 21 -
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.content).not.toContain("- 21 -");
  });

  it("署名欄と議決結果のフッターを除外する", () => {
    const text = `
      〇議 長（弓仲利博議員） 以上をもちまして閉会いたします。 （11時10分閉会）
      地方自治法第123条第2項の規定により、ここに署名する。
      令和6年3月19日 川西町議会
      （議決の結果）
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toContain("以上をもちまして閉会いたします。");
    expect(statements[0]!.content).not.toContain("地方自治法第123条");
    expect(statements[0]!.content).not.toContain("議決の結果");
  });
});

describe("extractHeldOn", () => {
  it("PDF 冒頭の日付を抽出する", () => {
    const text =
      "令和６年川西町議会 第１回定例会会議録 開会 令和 ６ 年 ３ 月 ５ 日 閉会 令和 ６ 年 ３ 月１９日";
    expect(extractHeldOn(text)).toBe("2024-03-05");
  });
});
