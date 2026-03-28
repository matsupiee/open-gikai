import { describe, expect, it } from "vitest";
import { parseConferenceMaterialPage, parseHeldOnFromTitle } from "./list";

describe("parseHeldOnFromTitle", () => {
  it("parses western calendar dates", () => {
    expect(parseHeldOnFromTitle("定例会３月会議（１日目）(2026.3.10)")).toBe(
      "2026-03-10",
    );
  });

  it("parses abbreviated reiwa dates", () => {
    expect(parseHeldOnFromTitle("定例会7月会議(R7.7.18)")).toBe("2025-07-18");
  });

  it("supports zero-padded dates", () => {
    expect(parseHeldOnFromTitle("令和元年度定例会３月会議（１日目）(2020.03.09)")).toBe(
      "2020-03-09",
    );
  });

  it("returns null when the title has no date", () => {
    expect(parseHeldOnFromTitle("総務教育常任委員会")).toBeNull();
  });
});

describe("parseConferenceMaterialPage", () => {
  it("extracts minutes PDFs from meeting blocks", () => {
    const html = `
      <div id="conferenceMaterial-content">
        <p>定例会６月会議(2025.6.19)</p>
        <table class="council"><tr><td>...</td></tr></table>
        <td colspan="5" style="text-align:center;">
          <a href="https://www.town.fukushima.hokkaido.jp/gikai/wp-content/uploads/2025/06/meeting.pdf">議事録</a>
        </td>
        <table class="other"><tr><td>...</td></tr></table>

        <p>総務教育常任委員会(2025.6.16)</p>
        <table class="council"><tr><td>...</td></tr></table>
        <td colspan="5" style="text-align:center;">
          <a href="/gikai/wp-content/uploads/2025/06/committee.pdf">議事録</a>
        </td>
      </div>
    `;

    const result = parseConferenceMaterialPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pdfUrl:
        "https://www.town.fukushima.hokkaido.jp/gikai/wp-content/uploads/2025/06/meeting.pdf",
      title: "定例会６月会議(2025.6.19)",
      heldOn: "2025-06-19",
      meetingType: "plenary",
    });
    expect(result[1]!.meetingType).toBe("committee");
    expect(result[1]!.heldOn).toBe("2025-06-16");
  });

  it("skips blocks without a minutes PDF", () => {
    const html = `
      <div id="conferenceMaterial-content">
        <p>定例会３月第２回会議(2026.3.26)</p>
        <table class="council"><tr><td>...</td></tr></table>
        <table class="other"><tr><td>...</td></tr></table>
      </div>
    `;

    expect(parseConferenceMaterialPage(html)).toEqual([]);
  });

  it("ignores non-meeting paragraphs", () => {
    const html = `
      <div id="conferenceMaterial-content">
        <p>更新情報です</p>
        <p>第3回議会基本条例諮問会議(2025.12.12)</p>
        <a href="/gikai/wp-content/uploads/2025/12/inquiry.pdf">議事録</a>
      </div>
    `;

    const result = parseConferenceMaterialPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("committee");
    expect(result[0]!.heldOn).toBe("2025-12-12");
  });
});
