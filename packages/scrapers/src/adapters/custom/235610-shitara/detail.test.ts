import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHeldOnFromPdfText,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（役職名のみ）を正しくパースする", () => {
    const result = parseSpeaker("議長 皆さん、明けましておめでとうございます。");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBeNull();
    expect(result!.speakerRole).toBe("議長");
    expect(result!.content).toBe("皆さん、明けましておめでとうございます。");
  });

  it("町長（役職名のみ）を正しくパースする", () => {
    const result = parseSpeaker("町長 皆さんおはようございます。");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBeNull();
    expect(result!.speakerRole).toBe("町長");
    expect(result!.content).toBe("皆さんおはようございます。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("副町長 おはようございます、今年もよろしくお願いいたします。");
    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("副町長");
    expect(result!.content).toBe("おはようございます、今年もよろしくお願いいたします。");
  });

  it("総務課長を正しくパースする", () => {
    const result = parseSpeaker("総務課長 それでは、説明をさせていただきます。");
    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("総務課長");
    expect(result!.content).toBe("それでは、説明をさせていただきます。");
  });

  it("番号+氏名（全角数字）の議員を正しくパースする", () => {
    const result = parseSpeaker("６今泉 おはようございます。");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("今泉");
    expect(result!.speakerRole).toBe("議員");
    expect(result!.content).toBe("おはようございます。");
  });

  it("番号+氏名（半角数字）の議員を正しくパースする", () => {
    const result = parseSpeaker("10田中 質問いたします。");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("田中");
    expect(result!.speakerRole).toBe("議員");
    expect(result!.content).toBe("質問いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("教育長 ご説明いたします。");
    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("教育長");
  });

  it("企画ダム対策課長を正しくパースする", () => {
    const result = parseSpeaker("企画ダム対策課長 報告いたします。");
    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("企画ダム対策課長");
    expect(result!.content).toBe("報告いたします。");
  });

  it("発言内容がない行は null を返す", () => {
    const result = parseSpeaker("議長");
    expect(result).toBeNull();
  });

  it("空行は null を返す", () => {
    const result = parseSpeaker("");
    expect(result).toBeNull();
  });

  it("発言者パターンに合致しない行は null を返す", () => {
    const result = parseSpeaker("令和８年第１回設楽町議会臨時会が設楽町役場議場に招集された。");
    expect(result).toBeNull();
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

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("総務課長は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("役職名パターンでテキストを分割する", () => {
    const text = `令和８年第１回設楽町議会臨時会会議録

令和８年１月７日第１回設楽町議会臨時会が設楽町役場議場に招集された。

議長 ただいまから会議を開きます。
町長 皆さんおはようございます。
６今泉 質問いたします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBeNull();
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.content).toBe("皆さんおはようございます。");

    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("今泉");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.content).toBe("質問いたします。");
  });

  it("複数行にわたる発言を結合する", () => {
    const text = `議長 これより一般質問を行います。
順番に進めてまいります。
では次に移ります。
町長 お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe(
      "これより一般質問を行います。 順番に進めてまいります。 では次に移ります。"
    );
  });

  it("ページ番号のみの行をスキップする", () => {
    const text = `議長 ただいまから会議を開きます。
1
町長 お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("議長 テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("extractHeldOnFromPdfText", () => {
  it("令和8年1月7日を正しく抽出する", () => {
    const text =
      "令和８年１月７日第１回設楽町議会臨時会が設楽町役場議場に招集された。";
    expect(extractHeldOnFromPdfText(text)).toBe("2026-01-07");
  });

  it("令和7年の日付を正しく抽出する", () => {
    const text =
      "令和７年３月１５日第１回設楽町議会定例会が招集された。";
    expect(extractHeldOnFromPdfText(text)).toBe("2025-03-15");
  });

  it("平成の日付を正しく変換する", () => {
    const text = "平成２５年３月１日第１回設楽町議会定例会が招集された。";
    expect(extractHeldOnFromPdfText(text)).toBe("2013-03-01");
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(extractHeldOnFromPdfText("日付情報なし")).toBeNull();
  });

  it("半角数字の日付も正しく処理する", () => {
    const text = "令和7年3月15日第1回設楽町議会定例会が招集された。";
    expect(extractHeldOnFromPdfText(text)).toBe("2025-03-15");
  });
});
