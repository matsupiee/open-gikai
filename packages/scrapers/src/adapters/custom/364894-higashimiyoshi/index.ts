import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchIssueList } from "./list";
import type { HigashimiyoshiIssue } from "./list";

export const adapter: ScraperAdapter = {
  name: "364894",

  async fetchList({ year }): Promise<ListRecord[]> {
    const issues = await fetchIssueList(year);

    return issues.map((issue) => ({
      detailParams: {
        title: issue.title,
        heldOn: issue.heldOn,
        pdfUrl: issue.pdfUrl,
        articleUrl: issue.articleUrl,
        issueNumber: issue.issueNumber,
        year: issue.year,
        month: issue.month,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const issue = detailParams as unknown as HigashimiyoshiIssue;
    return fetchMeetingData(issue, municipalityCode);
  },
};
