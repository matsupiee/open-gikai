import { describe, it, expect } from "vitest";
import { classifyKind, parseStatements, fetchMeetingData } from "./detail";
import type { NamegawaListRecord } from "./list";

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

  it("総務課長（サフィックス）は answer", () => {
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
  it("playlist エントリから statements を生成する", () => {
    const playlist = [
      {
        playlist_id: "2",
        speaker: "赤沼正副議員",
        speaker_id: "17",
        content: "１　町史編集について\n２　町道整備（補修等）について",
      },
      {
        playlist_id: "3",
        speaker: "阿部弘明議員",
        speaker_id: "5",
        content: "１　防災対策について",
      },
    ];

    const statements = parseStatements(playlist);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("赤沼正副");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.content).toBe(
      "１　町史編集について\n２　町道整備（補修等）について"
    );

    expect(statements[1]!.speakerName).toBe("阿部弘明");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.content).toBe("１　防災対策について");
  });

  it("speaker が null のエントリはスキップする", () => {
    const playlist = [
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "本会議　午前10時開会",
      },
      {
        playlist_id: "2",
        speaker: "山田議員",
        speaker_id: "3",
        content: "質問します。",
      },
    ];

    const statements = parseStatements(playlist);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("山田");
  });

  it("空の content はスキップする", () => {
    const playlist = [
      {
        playlist_id: "1",
        speaker: "山田議員",
        speaker_id: "3",
        content: "   ",
      },
    ];

    const statements = parseStatements(playlist);
    expect(statements).toHaveLength(0);
  });

  it("各 statement に contentHash が付与される", () => {
    const playlist = [
      {
        playlist_id: "1",
        speaker: "山田議員",
        speaker_id: "3",
        content: "テスト発言内容。",
      },
    ];

    const statements = parseStatements(playlist);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が連続して計算される", () => {
    const playlist = [
      {
        playlist_id: "1",
        speaker: "山田議員",
        speaker_id: "3",
        content: "最初の発言。",
      },
      {
        playlist_id: "2",
        speaker: "鈴木町長",
        speaker_id: "10",
        content: "答弁します。",
      },
    ];

    const statements = parseStatements(playlist);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("最初の発言。".length);
    expect(statements[1]!.startOffset).toBe("最初の発言。".length + 1);
    expect(statements[1]!.endOffset).toBe("最初の発言。".length + 1 + "答弁します。".length);
  });

  it("空の playlist は空配列を返す", () => {
    expect(parseStatements([])).toEqual([]);
  });
});

describe("fetchMeetingData", () => {
  it("有効なレコードから MeetingData を生成する", () => {
    const record: NamegawaListRecord = {
      councilId: "19",
      scheduleId: "1",
      councilLabel: "令和６年第２４０回滑川町議会定例会",
      scheduleLabel: "03月05日　本会議",
      heldOn: "2024-03-05",
      councilYear: "2024-03-13",
      playlist: [
        {
          playlist_id: "2",
          speaker: "赤沼正副議員",
          speaker_id: "17",
          content: "１　町史編集について",
        },
      ],
    };

    const result = fetchMeetingData(record, "municipality-id-1");

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("municipality-id-1");
    expect(result!.title).toBe("令和６年第２４０回滑川町議会定例会");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-03-05");
    expect(result!.sourceUrl).toBe(
      "https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/schedule.html?council_id=19&schedule_id=1&year="
    );
    expect(result!.externalId).toBe("namegawa_19_1");
    expect(result!.statements).toHaveLength(1);
  });

  it("委員会ラベルは meetingType が committee になる", () => {
    const record: NamegawaListRecord = {
      councilId: "10",
      scheduleId: "2",
      councilLabel: "総務経済建設常任委員会",
      scheduleLabel: "05月15日　委員会",
      heldOn: "2024-05-15",
      councilYear: "2024-05-15",
      playlist: [
        {
          playlist_id: "1",
          speaker: "委員長",
          speaker_id: "1",
          content: "委員会を開会します。",
        },
      ],
    };

    const result = fetchMeetingData(record, "municipality-id-1");

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("committee");
  });

  it("statements が空の場合は null を返す", () => {
    const record: NamegawaListRecord = {
      councilId: "19",
      scheduleId: "1",
      councilLabel: "令和６年第２４０回滑川町議会定例会",
      scheduleLabel: "03月05日　本会議",
      heldOn: "2024-03-05",
      councilYear: "2024-03-13",
      playlist: [
        {
          playlist_id: "1",
          speaker: null,
          speaker_id: "0",
          content: "開会宣告",
        },
      ],
    };

    const result = fetchMeetingData(record, "municipality-id-1");
    expect(result).toBeNull();
  });
});
