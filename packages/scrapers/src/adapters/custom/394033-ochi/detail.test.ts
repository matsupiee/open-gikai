import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名 君）を解析する（全角スペース入り氏名）", () => {
    const result = parseSpeaker("議　長（小 田 範 博 君）ただいまから会議を開きます。");
    expect(result.speakerName).toBe("小田範博");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("番号議員（氏名 君）を解析する（全角スペース入り）", () => {
    const result = parseSpeaker("８　番（武 智　 龍 君）それでは、一般質問をさせていただきます。");
    expect(result.speakerName).toBe("武智龍");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("それでは、一般質問をさせていただきます。");
  });

  it("課長（氏名 君）を解析する", () => {
    const result = parseSpeaker("産業課長（武智 久幸 君）おはようございます。武智議員にお答えいたします。");
    expect(result.speakerName).toBe("武智久幸");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("おはようございます。武智議員にお答えいたします。");
  });

  it("町長（氏名 君）を解析する", () => {
    const result = parseSpeaker("町　長（小田 保行 君）お答えいたします。");
    expect(result.speakerName).toBe("小田保行");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長（氏名 君）を解析する", () => {
    const result = parseSpeaker("副町長（國貞 誠志 君）ご説明いたします。");
    expect(result.speakerName).toBe("國貞誠志");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長（氏名 君）を解析する", () => {
    const result = parseSpeaker("教育長（織田 誠 君）答弁いたします。");
    expect(result.speakerName).toBe("織田誠");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁いたします。");
  });

  it("副議長を解析する", () => {
    const result = parseSpeaker("副議長（田中 花子 君）ご報告します。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("ご報告します。");
  });

  it("副委員長が委員長より優先される", () => {
    const result = parseSpeaker("副委員長（佐藤 一郎 君）ご説明します。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("事務局長を解析する", () => {
    const result = parseSpeaker("事務局長（田村 幸三 君）点呼を行います。");
    expect(result.speakerName).toBe("田村幸三");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("点呼を行います。");
  });

  it("番号議員の全角数字を正規化する", () => {
    const result = parseSpeaker("１　番（上岡 千世子 君）質問があります。");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("上岡千世子");
  });

  it("氏名中のスペースがすべて除去される", () => {
    const result = parseSpeaker("議　長（小 田 範 博 君）発言します。");
    expect(result.speakerName).toBe("小田範博");
  });

  it("発言者が解析できない行", () => {
    const result = parseSpeaker("令和７年第２回越知町議会定例会　会議録");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("課長補佐は answer", () => {
    expect(classifyKind("課長補佐")).toBe("answer");
  });

  it("産業課長（課長で終わる）は answer", () => {
    expect(classifyKind("産業課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("越知町形式の発言を分割する", () => {
    const text = [
      "議　長（小 田 範 博 君）ただいまから会議を開きます。",
      "８　番（武 智　 龍 君）それでは、一般質問をさせていただきます。",
      "産業課長（武智 久幸 君）お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("小田範博");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("課長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "議　長（小 田 範 博 君）ただいまから会議を開きます。";

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("複数行にまたがる発言内容を結合する", () => {
    const text = [
      "議　長（小 田 範 博 君）ただいまから会議を開きます。",
      "出席者を確認します。",
      "８　番（武 智　 龍 君）質問します。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから会議を開きます。");
    expect(statements[0]!.content).toContain("出席者を確認します。");
  });

  it("発言者のいないテキストのみの場合は空配列を返す", () => {
    const text = "令和７年第２回越知町議会定例会　会議録";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "議　長（小 田 範 博 君）ただいま。",
      "１　番（上 岡 千 世 子 君）質問です。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });
});
