import { describe, expect, it } from "vitest";
import { groupByMeeting } from "./list";
import type { HatsugenRecord } from "./shared";

describe("groupByMeeting", () => {
  it("同じ title と ym のレコードを1つの会議にまとめる", () => {
    const records: HatsugenRecord[] = [
      {
        id: "012033_1",
        speaker: "委員長",
        title: "総務常任委員会",
        ym: "2506",
        nendo: 2025,
        text: "ただいまから会議を開きます。",
        text_length: 14,
      },
      {
        id: "012033_2",
        speaker: "松岩委員",
        title: "総務常任委員会",
        ym: "2506",
        nendo: 2025,
        text: "質問いたします。",
        text_length: 8,
      },
      {
        id: "012033_3",
        speaker: "委員長",
        title: "総務常任委員会",
        ym: "2506",
        nendo: 2025,
        text: "以上で会議を閉じます。",
        text_length: 11,
      },
    ];

    const meetings = groupByMeeting(records);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("総務常任委員会");
    expect(meetings[0]!.ym).toBe("2506");
    expect(meetings[0]!.records).toHaveLength(3);
  });

  it("異なる title のレコードを別の会議に分ける", () => {
    const records: HatsugenRecord[] = [
      {
        id: "012033_1",
        speaker: "委員長",
        title: "総務常任委員会",
        ym: "2506",
        nendo: 2025,
        text: "開会します。",
        text_length: 6,
      },
      {
        id: "012033_2",
        speaker: "委員長",
        title: "建設常任委員会",
        ym: "2506",
        nendo: 2025,
        text: "開会します。",
        text_length: 6,
      },
    ];

    const meetings = groupByMeeting(records);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.title).toBe("総務常任委員会");
    expect(meetings[1]!.title).toBe("建設常任委員会");
  });

  it("同じ title でも異なる ym は別の会議になる", () => {
    const records: HatsugenRecord[] = [
      {
        id: "012033_1",
        speaker: "委員長",
        title: "総務常任委員会",
        ym: "2506",
        nendo: 2025,
        text: "開会します。",
        text_length: 6,
      },
      {
        id: "012033_2",
        speaker: "委員長",
        title: "総務常任委員会",
        ym: "2507",
        nendo: 2025,
        text: "開会します。",
        text_length: 6,
      },
    ];

    const meetings = groupByMeeting(records);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.ym).toBe("2506");
    expect(meetings[1]!.ym).toBe("2507");
  });

  it("空配列に対して空配列を返す", () => {
    const meetings = groupByMeeting([]);
    expect(meetings).toHaveLength(0);
  });
});
