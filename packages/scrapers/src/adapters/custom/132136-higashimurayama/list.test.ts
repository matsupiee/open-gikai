import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

const SAMPLE_HTML = `
<h2>3月定例会</h2>
<div class="wysiwyg_wp">
 <p><a class="resourceLink newWindow pdf link_file" href="/gikai/gikaijoho/kensaku/r6_honkaigi/files/0221.pdf">第1回　令和6年2月21日（PDF：966KB）</a><br>
 <a class="resourceLink newWindow pdf link_file" href="/gikai/gikaijoho/kensaku/r6_honkaigi/files/0222.pdf">第2回　令和6年2月22日（PDF：904KB）</a></p>
 <h2>5月臨時会</h2>
 <div class="wysiwyg_wp">
  <p><a class="resourceLink newWindow pdf link_file" href="/gikai/gikaijoho/kensaku/r6_honkaigi/files/0523.pdf">第7回　令和6年5月23日（PDF：711KB）</a></p>
 </div>
</div>
`;

const IINKAI_HTML = `
<h2>政策総務委員会</h2>
<p><a class="link_file pdf" href="/gikai/gikaijoho/kensaku/r6_iinkai/files/0304seisaku.pdf">第1回　令和6年3月4日（PDF：800KB）</a></p>
<h2>厚生委員会</h2>
<p><a class="link_file pdf" href="/gikai/gikaijoho/kensaku/r6_iinkai/files/0306kousei.pdf">第1回　令和6年3月6日（PDF：750KB）</a></p>
`;

describe("parseListPage — honkaigi", () => {
  it("HTML から PDF リンクを正しく抽出する", () => {
    const meetings = parseListPage(SAMPLE_HTML, "honkaigi");

    expect(meetings.length).toBe(3);

    expect(meetings[0]!.heldOn).toBe("2024-02-21");
    expect(meetings[0]!.title).toBe("3月定例会 第1回　令和6年2月21日");
    expect(meetings[0]!.section).toBe("3月定例会");
    expect(meetings[0]!.category).toBe("honkaigi");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.higashimurayama.tokyo.jp/gikai/gikaijoho/kensaku/r6_honkaigi/files/0221.pdf"
    );

    expect(meetings[1]!.heldOn).toBe("2024-02-22");

    expect(meetings[2]!.heldOn).toBe("2024-05-23");
    expect(meetings[2]!.section).toBe("5月臨時会");
    expect(meetings[2]!.title).toBe("5月臨時会 第7回　令和6年5月23日");
  });
});

describe("parseListPage — iinkai", () => {
  it("委員会ページから PDF リンクを正しく抽出する", () => {
    const meetings = parseListPage(IINKAI_HTML, "iinkai");

    expect(meetings.length).toBe(2);

    expect(meetings[0]!.section).toBe("政策総務委員会");
    expect(meetings[0]!.heldOn).toBe("2024-03-04");
    expect(meetings[0]!.category).toBe("iinkai");

    expect(meetings[1]!.section).toBe("厚生委員会");
    expect(meetings[1]!.heldOn).toBe("2024-03-06");
  });
});
