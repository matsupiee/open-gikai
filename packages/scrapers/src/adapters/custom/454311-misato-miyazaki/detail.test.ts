import { describe, expect, it } from "vitest";
import { buildMeetingData, buildStatements, classifyKind } from "./detail";
import type { PlaylistItem } from "./list";

describe("classifyKind", () => {
  it("speaker_id '0' は remark", () => {
    expect(classifyKind(null, "0")).toBe("remark");
  });

  it("speaker が null は remark", () => {
    expect(classifyKind(null, "5")).toBe("remark");
  });

  it("speaker が空文字は remark", () => {
    expect(classifyKind("", "5")).toBe("remark");
  });

  it("議長を含む speaker は remark", () => {
    expect(classifyKind("議長", "1")).toBe("remark");
  });

  it("副議長を含む speaker は remark", () => {
    expect(classifyKind("副議長", "2")).toBe("remark");
  });

  it("委員長を含む speaker は remark", () => {
    expect(classifyKind("委員長", "3")).toBe("remark");
  });

  it("副委員長を含む speaker は remark", () => {
    expect(classifyKind("副委員長", "4")).toBe("remark");
  });

  it("町長を含む speaker は answer", () => {
    expect(classifyKind("町長", "10")).toBe("answer");
  });

  it("副町長を含む speaker は answer", () => {
    expect(classifyKind("副町長", "11")).toBe("answer");
  });

  it("教育長を含む speaker は answer", () => {
    expect(classifyKind("教育長", "12")).toBe("answer");
  });

  it("課長を含む speaker は answer", () => {
    expect(classifyKind("総務課長", "13")).toBe("answer");
  });

  it("事務局長を含む speaker は answer", () => {
    expect(classifyKind("事務局長", "14")).toBe("answer");
  });

  it("議員を含む speaker は question", () => {
    expect(classifyKind("田中一郎議員", "20")).toBe("question");
  });

  it("一般的な議員名は question", () => {
    expect(classifyKind("山田花子議員", "15")).toBe("question");
  });
});

describe("buildStatements", () => {
  it("playlist アイテムから statements を生成する", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "田中一郎議員",
        speaker_id: "20",
        content: "１　農業振興策について\n２　道路整備について",
        movie_name1: "miyazaki/2025/2025030201.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "町長",
        speaker_id: "10",
        content: "農業振興策についてお答えいたします。",
        movie_name1: "miyazaki/2025/2025030202.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("田中一郎議員");
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.content).toBe("１　農業振興策について\n２　道路整備について");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("町長");
  });

  it("content が空の playlist アイテムはスキップする", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "田中一郎議員",
        speaker_id: "20",
        content: "",
        movie_name1: "miyazaki/2025/2025030201.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "山田花子議員",
        speaker_id: "15",
        content: "農業振興策について",
        movie_name1: "miyazaki/2025/2025030202.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("山田花子議員");
  });

  it("speaker_id '0' の発言は remark になる", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "開会、会期の決定",
        movie_name1: "miyazaki/2025/2025022101.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
  });

  it("offset が正しく計算される", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "田中一郎議員",
        speaker_id: "20",
        content: "質問です",
        movie_name1: "miyazaki/2025/2025030201.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "町長",
        speaker_id: "10",
        content: "お答えします",
        movie_name1: "miyazaki/2025/2025030202.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("質問です".length);
    expect(statements[1]!.startOffset).toBe("質問です".length + 1);
    expect(statements[1]!.endOffset).toBe("質問です".length + 1 + "お答えします".length);
  });

  it("空の playlist は空配列を返す", () => {
    expect(buildStatements([])).toHaveLength(0);
  });
});

describe("buildMeetingData", () => {
  it("正常なパラメータから MeetingData を組み立てる", () => {
    const result = buildMeetingData(
      {
        councilId: "84",
        councilLabel: "令和7年第1回定例会",
        councilYear: "2025-02-21",
        scheduleId: "2",
        scheduleLabel: "3月2日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "田中一郎議員",
            speaker_id: "20",
            content: "農業振興策について",
            movie_name1: "miyazaki/2025/2025030201.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("muni-123");
    expect(result!.title).toBe("令和7年第1回定例会 3月2日　一般質問");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2025-03-02");
    expect(result!.sourceUrl).toBe(
      "https://smart.discussvision.net/smart/tenant/miyazaki/WebView/rd/schedule.html?council_id=84&schedule_id=2",
    );
    expect(result!.externalId).toBe("misato_miyazaki_84_2");
    expect(result!.statements).toHaveLength(1);
  });

  it("臨時会の meetingType が extraordinary になる", () => {
    const result = buildMeetingData(
      {
        councilId: "80",
        councilLabel: "令和6年第2回臨時会",
        councilYear: "2024-08-05",
        scheduleId: "1",
        scheduleLabel: "8月5日　臨時会",
        playlist: [
          {
            playlist_id: "1",
            speaker: "議長",
            speaker_id: "1",
            content: "議事進行",
            movie_name1: "miyazaki/2024/2024080501.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("1桁の月日を含む scheduleLabel も正しく解析する", () => {
    const result = buildMeetingData(
      {
        councilId: "84",
        councilLabel: "令和7年第1回定例会",
        councilYear: "2025-02-21",
        scheduleId: "1",
        scheduleLabel: "2月21日　開会",
        playlist: [
          {
            playlist_id: "1",
            speaker: null,
            speaker_id: "0",
            content: "開会、会期の決定",
            movie_name1: "miyazaki/2025/2025022101.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-456",
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2025-02-21");
  });

  it("playlist が全て空 content なら null を返す", () => {
    const result = buildMeetingData(
      {
        councilId: "84",
        councilLabel: "令和7年第1回定例会",
        councilYear: "2025-02-21",
        scheduleId: "2",
        scheduleLabel: "3月2日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "田中一郎議員",
            speaker_id: "20",
            content: "",
            movie_name1: "miyazaki/2025/2025030201.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).toBeNull();
  });

  it("scheduleLabel から日付が抽出できない場合は null を返す", () => {
    const result = buildMeetingData(
      {
        councilId: "84",
        councilLabel: "令和7年第1回定例会",
        councilYear: "2025-02-21",
        scheduleId: "2",
        scheduleLabel: "不明な日程",
        playlist: [
          {
            playlist_id: "1",
            speaker: "田中一郎議員",
            speaker_id: "20",
            content: "農業振興策について",
            movie_name1: "miyazaki/2025/2025030201.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).toBeNull();
  });
});
