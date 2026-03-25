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
    expect(classifyKind("吉田芳美議員", "20")).toBe("question");
  });

  it("一般的な議員名は question", () => {
    expect(classifyKind("佐藤一朗議員", "15")).toBe("question");
  });
});

describe("buildStatements", () => {
  it("playlist アイテムから statements を生成する", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "吉田芳美議員",
        speaker_id: "20",
        content: "１　新型コロナウイルス感染症について\n２　町道の整備事業について",
        movie_name1: "kahoku/2024/0308000201.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "町長",
        speaker_id: "10",
        content: "新型コロナウイルス感染症についてお答えいたします。",
        movie_name1: "kahoku/2024/0308000202.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("吉田芳美議員");
    expect(statements[0]!.content).toBe("１　新型コロナウイルス感染症について\n２　町道の整備事業について");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("町長");
  });

  it("content が空の playlist アイテムはスキップする", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: "吉田芳美議員",
        speaker_id: "20",
        content: "",
        movie_name1: "kahoku/2024/0308000201.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "佐藤一朗議員",
        speaker_id: "15",
        content: "農業振興策について",
        movie_name1: "kahoku/2024/0308000202.mp4",
        movie_released: "2",
      },
    ];

    const statements = buildStatements(playlist);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("佐藤一朗議員");
  });

  it("speaker_id '0' の発言は remark になる", () => {
    const playlist: PlaylistItem[] = [
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "議事進行に関する説明",
        movie_name1: "kahoku/2024/0110000101.mp4",
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
        speaker: "吉田芳美議員",
        speaker_id: "20",
        content: "質問です",
        movie_name1: "kahoku/2024/0308000201.mp4",
        movie_released: "2",
      },
      {
        playlist_id: "2",
        speaker: "町長",
        speaker_id: "10",
        content: "お答えします",
        movie_name1: "kahoku/2024/0308000202.mp4",
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
        councilId: "98",
        councilLabel: "令和6年3月定例会",
        councilYear: "2024-03-15",
        scheduleId: "2",
        scheduleLabel: "03月08日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "吉田芳美議員",
            speaker_id: "20",
            content: "新型コロナウイルス感染症について",
            movie_name1: "kahoku/2024/0308000201.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).not.toBeNull();
    expect(result!.municipalityCode).toBe("muni-123");
    expect(result!.title).toBe("令和6年3月定例会 03月08日　一般質問");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBe("2024-03-08");
    expect(result!.sourceUrl).toBe(
      "https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/schedule.html?council_id=98&schedule_id=2",
    );
    expect(result!.externalId).toBe("kahoku_98_2");
    expect(result!.statements).toHaveLength(1);
  });

  it("臨時会の meetingType が extraordinary になる", () => {
    const result = buildMeetingData(
      {
        councilId: "97",
        councilLabel: "令和6年1月臨時会",
        councilYear: "2024-01-10",
        scheduleId: "1",
        scheduleLabel: "01月10日　臨時会",
        playlist: [
          {
            playlist_id: "1",
            speaker: "議長",
            speaker_id: "1",
            content: "議事進行",
            movie_name1: "kahoku/2024/0110000101.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("委員会の meetingType が committee になる", () => {
    const result = buildMeetingData(
      {
        councilId: "98",
        councilLabel: "令和6年3月定例会",
        councilYear: "2024-03-15",
        scheduleId: "3",
        scheduleLabel: "03月11日　予算審査特別委員会",
        playlist: [
          {
            playlist_id: "1",
            speaker: "田中委員長",
            speaker_id: "5",
            content: "令和6年度一般会計予算審査",
            movie_name1: "kahoku/2024/0311000301.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-456",
    );

    expect(result).not.toBeNull();
    expect(result!.meetingType).toBe("plenary");
  });

  it("playlist が全て空 content なら null を返す", () => {
    const result = buildMeetingData(
      {
        councilId: "98",
        councilLabel: "令和6年3月定例会",
        councilYear: "2024-03-15",
        scheduleId: "2",
        scheduleLabel: "03月08日　一般質問",
        playlist: [
          {
            playlist_id: "1",
            speaker: "吉田芳美議員",
            speaker_id: "20",
            content: "",
            movie_name1: "kahoku/2024/0308000201.mp4",
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
        councilId: "98",
        councilLabel: "令和6年3月定例会",
        councilYear: "2024-03-15",
        scheduleId: "2",
        scheduleLabel: "不明な日程",
        playlist: [
          {
            playlist_id: "1",
            speaker: "吉田芳美議員",
            speaker_id: "20",
            content: "新型コロナウイルス感染症について",
            movie_name1: "kahoku/2024/0308000201.mp4",
            movie_released: "2",
          },
        ],
      },
      "muni-123",
    );

    expect(result).toBeNull();
  });
});
