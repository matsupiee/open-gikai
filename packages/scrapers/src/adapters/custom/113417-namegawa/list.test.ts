import { describe, it, expect } from "vitest";
import {
  parseCouncilResponse,
  buildSourceUrl,
  buildExternalId,
} from "./list";
import {
  extractDateFromScheduleLabel,
  detectMeetingType,
  normalizeSpeakerName,
} from "./shared";

describe("parseCouncilResponse", () => {
  it("正常なレスポンスをパースする", () => {
    const json = [
      {
        council_id: "19",
        year: "2024-03-13",
        label: "令和６年第２４０回滑川町議会定例会",
        schedules: [
          {
            schedule_id: "1",
            label: "03月05日　本会議",
            playlist: [
              {
                playlist_id: "1",
                speaker: null,
                speaker_id: "0",
                content: "本会議　午前10時開会",
                movie_released: "2",
              },
              {
                playlist_id: "2",
                speaker: "赤沼正副議員",
                speaker_id: "17",
                content: "１　町史編集について",
                movie_released: "2",
              },
            ],
          },
        ],
      },
    ];

    const result = parseCouncilResponse(json);

    expect(result).toHaveLength(1);
    expect(result[0]!.council_id).toBe("19");
    expect(result[0]!.year).toBe("2024-03-13");
    expect(result[0]!.label).toBe("令和６年第２４０回滑川町議会定例会");
    expect(result[0]!.schedules).toHaveLength(1);
    expect(result[0]!.schedules[0]!.playlist).toHaveLength(2);
  });

  it("空配列の場合は空を返す", () => {
    expect(parseCouncilResponse([])).toEqual([]);
  });

  it("配列でない場合は空を返す", () => {
    expect(parseCouncilResponse(null)).toEqual([]);
    expect(parseCouncilResponse("invalid")).toEqual([]);
    expect(parseCouncilResponse({})).toEqual([]);
  });

  it("不正なエントリはスキップする", () => {
    const json = [
      null,
      { council_id: "1", year: "2024-01-01", label: "会議", schedules: [] },
      undefined,
    ];
    const result = parseCouncilResponse(json);
    expect(result).toHaveLength(1);
  });
});

describe("extractDateFromScheduleLabel", () => {
  it("スケジュールラベルから開催日を抽出する", () => {
    expect(extractDateFromScheduleLabel("03月05日　本会議", "2024-03-13")).toBe("2024-03-05");
  });

  it("別の月日も正しく変換する", () => {
    expect(extractDateFromScheduleLabel("12月20日　全員協議会", "2023-12-20")).toBe("2023-12-20");
  });

  it("月日パターンがない場合は null を返す", () => {
    expect(extractDateFromScheduleLabel("本会議", "2024-03-13")).toBeNull();
  });

  it("council.year の年部分を使う", () => {
    expect(extractDateFromScheduleLabel("06月10日　本会議", "2023-06-15")).toBe("2023-06-10");
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary", () => {
    expect(detectMeetingType("令和６年第２４０回滑川町議会定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary", () => {
    expect(detectMeetingType("令和６年滑川町議会臨時会")).toBe("extraordinary");
  });

  it("委員会は committee", () => {
    expect(detectMeetingType("総務経済建設常任委員会")).toBe("committee");
  });

  it("予算審査特別委員会は committee", () => {
    expect(detectMeetingType("予算審査特別委員会")).toBe("committee");
  });

  it("文教厚生常任委員会は committee", () => {
    expect(detectMeetingType("文教厚生常任委員会")).toBe("committee");
  });
});

describe("normalizeSpeakerName", () => {
  it("議員サフィックスを除去する", () => {
    const result = normalizeSpeakerName("赤沼正副議員");
    expect(result.speakerName).toBe("赤沼正副");
    expect(result.speakerRole).toBe("議員");
  });

  it("議長サフィックスを除去する", () => {
    const result = normalizeSpeakerName("山田太郎議長");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
  });

  it("町長サフィックスを除去する", () => {
    const result = normalizeSpeakerName("鈴木一郎町長");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
  });

  it("副委員長は委員長より先にマッチする", () => {
    const result = normalizeSpeakerName("高橋副委員長");
    expect(result.speakerName).toBe("高橋");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("役職サフィックスがない場合はそのまま返す", () => {
    const result = normalizeSpeakerName("山田太郎");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBeNull();
  });
});

describe("buildSourceUrl", () => {
  it("正しい URL を生成する", () => {
    const url = buildSourceUrl("19", "1");
    expect(url).toBe(
      "https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/schedule.html?council_id=19&schedule_id=1&year="
    );
  });
});

describe("buildExternalId", () => {
  it("正しい外部 ID を生成する", () => {
    expect(buildExternalId("19", "1")).toBe("namegawa_19_1");
  });

  it("別の ID でも正しく生成する", () => {
    expect(buildExternalId("5", "3")).toBe("namegawa_5_3");
  });
});
