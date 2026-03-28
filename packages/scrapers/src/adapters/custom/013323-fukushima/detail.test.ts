import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOnFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("parses the chair", () => {
    const result = parseSpeaker("○議長（溝部幸基） ただいまから会議を開きます。");
    expect(result.speakerName).toBe("溝部幸基");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("parses executive answers", () => {
    const result = parseSpeaker("○町長（鳴海清春） ご説明申し上げます。");
    expect(result.speakerName).toBe("鳴海清春");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("parses numbered council members as legislators", () => {
    const result = parseSpeaker("○１番（藤山大） 質問いたします。");
    expect(result.speakerName).toBe("藤山大");
    expect(result.speakerRole).toBe("議員");
  });

  it("matches longer role suffixes first", () => {
    const result = parseSpeaker("◎副委員長（田中太郎） 報告いたします。");
    expect(result.speakerRole).toBe("副委員長");
  });
});

describe("classifyKind", () => {
  it("marks chairs as remarks", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("marks administrators as answers", () => {
    expect(classifyKind("町長")).toBe("answer");
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("marks legislators as questions", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("extractHeldOnFromText", () => {
  it("extracts the first japanese era date", () => {
    expect(
      extractHeldOnFromText("令和７年６月１９日 開会 令和７年６月１９日 休会"),
    ).toBe("2025-06-19");
  });

  it("supports era year gan", () => {
    expect(extractHeldOnFromText("令和元年５月３１日 開会")).toBe("2019-05-31");
  });
});

describe("parseStatements", () => {
  it("extracts spoken statements and skips agenda headings", () => {
    const text = `
◎開 会 ・ 開 議 宣 告
○議長（溝部幸基）
ただいまから、令和７年度定例会６月会議を開会いたします。
○町長（鳴海清春）
改めまして、おはようございます。
○１番（藤山大）
通告に従い、町長に一般質問させていただきます。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("supports committee speakers with ◎ markers", () => {
    const text = `
◎委員長（田中太郎）
これより委員会を開会いたします。
○総務課長（佐藤次郎）
資料に基づき説明いたします。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("委員長");
    expect(statements[1]!.speakerRole).toBe("課長");
  });

  it("generates sha256 hashes for statement content", () => {
    const statements = parseStatements("○議長（溝部幸基） ただいま。");
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
