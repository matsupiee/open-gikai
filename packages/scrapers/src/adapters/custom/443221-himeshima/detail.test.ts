import { describe, expect, it } from "vitest";
import { fetchMeetingData } from "./detail";

describe("fetchMeetingData", () => {
  it("現状の公開資料では会議録本文を取得できないため null を返す", async () => {
    const result = await fetchMeetingData(
      {
        pdfUrl: "https://www.himeshima.jp/wp-content/uploads/2025/03/r7-1-teireikai-kaigiroku.pdf",
        linkText: "令和7年第1回定例会 会議録",
        kind: "minutes",
        year: 2025,
        heldOn: "2025-03-04",
        title: "令和7年第1回定例会 会議録",
        meetingType: "plenary",
      },
      "municipality-id-dummy"
    );

    expect(result).toBeNull();
  });
});
