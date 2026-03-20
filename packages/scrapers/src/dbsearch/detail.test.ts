import { describe, expect, test } from "vitest";
import {
  extractTitle,
  extractDate,
  detectMeetingType,
  parseSpeakerFromTitle,
  classifyKind,
  cleanVoiceText,
  stripSpeakerPrefix,
  extractStatements,
} from "./detail";

describe("extractTitle", () => {
  test("command__docname から抽出", () => {
    const html = '<span class="command__docname">令和６年第１回定例会</span>';
    expect(extractTitle(html)).toBe("令和６年第１回定例会");
  });

  test("空白を正規化する", () => {
    const html =
      '<span class="command__docname">令和６年  第１回　定例会</span>';
    expect(extractTitle(html)).toBe("令和６年 第１回 定例会");
  });

  test("マッチしない場合はnull", () => {
    expect(extractTitle("<div>タイトルなし</div>")).toBeNull();
  });
});

describe("extractDate", () => {
  test("YYYY-MM-DD 形式の日付を抽出", () => {
    const html = '<span class="command__date">2024-03-15</span>';
    expect(extractDate(html)).toBe("2024-03-15");
  });

  test("マッチしない場合はnull", () => {
    expect(extractDate('<span class="command__date">不明</span>')).toBeNull();
  });
});

describe("detectMeetingType", () => {
  test("委員会を含むタイトルは committee", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  test("臨時会を含むタイトルは extraordinary", () => {
    expect(detectMeetingType("令和６年臨時会")).toBe("extraordinary");
  });

  test("臨時を含むタイトルは extraordinary", () => {
    expect(detectMeetingType("臨時議会")).toBe("extraordinary");
  });

  test("その他は plenary", () => {
    expect(detectMeetingType("令和６年第１回定例会")).toBe("plenary");
  });
});

describe("parseSpeakerFromTitle", () => {
  test("◯役職（氏名）形式", () => {
    const result = parseSpeakerFromTitle("◯議長（高瀬博文）");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("高瀬博文");
  });

  test("○議会事務局長（氏名）形式", () => {
    const result = parseSpeakerFromTitle("○議会事務局長（八鍬政幸）");
    expect(result.speakerRole).toBe("議会事務局長");
    expect(result.speakerName).toBe("八鍬政幸");
  });

  test("敬称（さん）を除去", () => {
    const result = parseSpeakerFromTitle("◯議員（田中さん）");
    expect(result.speakerName).toBe("田中");
  });

  test("敬称（君）を除去", () => {
    const result = parseSpeakerFromTitle("◯議員（田中君）");
    expect(result.speakerName).toBe("田中");
  });

  test("括弧なし（役職のみ）", () => {
    const result = parseSpeakerFromTitle("◯議長");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBeNull();
  });

  test("空文字", () => {
    const result = parseSpeakerFromTitle("");
    expect(result.speakerRole).toBeNull();
    expect(result.speakerName).toBeNull();
  });
});

describe("classifyKind", () => {
  test("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  test("委員は question", () => {
    expect(classifyKind("委員")).toBe("question");
  });

  test("議席番号（半角）は question", () => {
    expect(classifyKind("7番")).toBe("question");
  });

  test("議席番号（全角）は question", () => {
    expect(classifyKind("１７番")).toBe("question");
  });

  test("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  test("委員長は remark", () => {
    expect(classifyKind("総務委員長")).toBe("remark");
  });

  test("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  test("部長は answer", () => {
    expect(classifyKind("総務部長")).toBe("answer");
  });

  test("課長は answer", () => {
    expect(classifyKind("企画課長")).toBe("answer");
  });

  test("nullは remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("cleanVoiceText", () => {
  test("br タグを改行に変換", () => {
    expect(cleanVoiceText("行1<br>行2")).toBe("行1\n行2");
    expect(cleanVoiceText("行1<br/>行2")).toBe("行1\n行2");
    expect(cleanVoiceText("行1<BR />行2")).toBe("行1\n行2");
  });

  test("HTML タグを除去", () => {
    expect(cleanVoiceText("<b>太字</b>")).toBe("太字");
  });

  test("HTML エンティティをデコード", () => {
    expect(cleanVoiceText("&amp; &lt; &gt; &quot; &nbsp;")).toBe('& < > "');
  });

  test("連続改行を圧縮", () => {
    expect(cleanVoiceText("行1\n\n\n\n行2")).toBe("行1\n\n行2");
  });
});

describe("stripSpeakerPrefix", () => {
  test("◯役職（氏名）ヘッダーを除去", () => {
    expect(stripSpeakerPrefix("◯総務課長（小海途　聡君）　これは本文です。")).toBe(
      "これは本文です。"
    );
  });

  test("〔登壇〕の補足表記を含む場合も除去", () => {
    expect(
      stripSpeakerPrefix("◯議員（田中太郎）〔登壇〕　質問があります。")
    ).toBe("質問があります。");
  });

  test("ヘッダーがない場合はそのまま", () => {
    expect(stripSpeakerPrefix("これは本文です。")).toBe("これは本文です。");
  });
});

describe("extractStatements", () => {
  test("voice-block から発言を抽出する", () => {
    const html = `
      <ul class="page-list" id="page-list">
        <li class="voice-block" data-voice-title="◯議長（高瀬博文）">
          <p class="voice__text">ただいまから会議を開きます。</p>
        </li>
        <li class="voice-block" data-voice-title="◯議員（田中太郎）">
          <p class="voice__text">賛成の立場から発言します。</p>
        </li>
      </ul>
    `;
    const stmts = extractStatements(html);
    expect(stmts).toHaveLength(2);

    expect(stmts[0]!.speakerRole).toBe("議長");
    expect(stmts[0]!.speakerName).toBe("高瀬博文");
    expect(stmts[0]!.kind).toBe("remark");
    expect(stmts[0]!.content).toBe("ただいまから会議を開きます。");

    expect(stmts[1]!.speakerRole).toBe("議員");
    expect(stmts[1]!.speakerName).toBe("田中太郎");
    expect(stmts[1]!.kind).toBe("question");
    expect(stmts[1]!.content).toBe("賛成の立場から発言します。");
  });

  test("voice__text が空の場合はスキップ", () => {
    const html = `
      <li class="voice-block" data-voice-title="◯議長（高瀬博文）">
        <p class="voice__text"></p>
      </li>
    `;
    expect(extractStatements(html)).toHaveLength(0);
  });

  test("offset が正しく計算される", () => {
    const html = `
      <li class="voice-block" data-voice-title="◯議員（A）">
        <p class="voice__text">あいう</p>
      </li>
      <li class="voice-block" data-voice-title="◯議員（B）">
        <p class="voice__text">えお</p>
      </li>
    `;
    const stmts = extractStatements(html);
    expect(stmts[0]!.startOffset).toBe(0);
    expect(stmts[0]!.endOffset).toBe(3);
    expect(stmts[1]!.startOffset).toBe(4);
    expect(stmts[1]!.endOffset).toBe(6);
  });

  test("contentHash が生成される", () => {
    const html = `
      <li class="voice-block" data-voice-title="◯議員（A）">
        <p class="voice__text">テスト</p>
      </li>
    `;
    const stmts = extractStatements(html);
    expect(stmts[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
