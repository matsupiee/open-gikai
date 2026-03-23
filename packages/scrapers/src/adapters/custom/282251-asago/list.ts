/**
 * 朝来市議会 会議録検索システム — list フェーズ
 *
 * ASP.NET postback を使って年度→会議種別→開催回次→会議名の
 * 4段階ドロップダウンを順次選択し、全会議の一覧を収集する。
 */

import {
  MEETING_KINDS,
  buildYearLabel,
  extractAspNetFields,
  extractComboItems,
  extractHeldOn,
  fetchInitialPage,
  postBack,
} from "./shared";

export interface AsagoDocument {
  /** 会議名（ドロップダウンの値） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別ドロップダウンの値 */
  kind: string;
  /** 開催回次ドロップダウンの値 */
  kaisu: string;
}

/** postback 間のウェイト (ms) */
const DELAY_MS = 1_500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指定年の全会議一覧を取得する。
 * postback を使って各ドロップダウンを順次選択し、会議名を収集する。
 */
export async function fetchDocumentList(
  year: number,
): Promise<AsagoDocument[]> {
  const allDocuments: AsagoDocument[] = [];
  const yearLabel = buildYearLabel(year);

  // 初期ページ取得
  const { html: initialHtml, sessionCookie } = await fetchInitialPage();

  // Step 1: 年度選択
  let fields = extractAspNetFields(initialHtml);
  await delay(DELAY_MS);
  const htmlAfterYear = await postBack(
    sessionCookie,
    fields,
    "ASPxPageControl$ASPxComboBYearL",
    { "ASPxPageControl$ASPxComboBYearL": yearLabel },
  );

  // Step 2: 各会議種別を巡回
  const kindItems = extractComboItems(htmlAfterYear, "ASPxComboBKind");
  const kindsToProcess =
    kindItems.length > 0 ? kindItems : [...MEETING_KINDS];

  for (const kind of kindsToProcess) {
    // 種別ごとに年度ポストバックをやり直して最新の ViewState を取得する。
    // 前の種別選択でサーバー側の状態が変わるため、htmlAfterYear の
    // __VIEWSTATE を再利用すると 2 番目以降の種別で失敗する可能性がある。
    fields = extractAspNetFields(htmlAfterYear);
    await delay(DELAY_MS);
    const freshHtmlAfterYear = await postBack(
      sessionCookie,
      fields,
      "ASPxPageControl$ASPxComboBYearL",
      { "ASPxPageControl$ASPxComboBYearL": yearLabel },
    );

    fields = extractAspNetFields(freshHtmlAfterYear);
    await delay(DELAY_MS);
    const htmlAfterKind = await postBack(
      sessionCookie,
      fields,
      "ASPxPageControl$ASPxComboBKind",
      {
        "ASPxPageControl$ASPxComboBYearL": yearLabel,
        "ASPxPageControl$ASPxComboBKind": kind,
      },
    );

    // Step 3: 各開催回次を巡回
    const kaisuItems = extractComboItems(
      htmlAfterKind,
      "ASPxComboBKaisuL",
    );

    for (const kaisu of kaisuItems) {
      fields = extractAspNetFields(htmlAfterKind);
      await delay(DELAY_MS);
      const htmlAfterKaisu = await postBack(
        sessionCookie,
        fields,
        "ASPxPageControl$ASPxComboBKaisuL",
        {
          "ASPxPageControl$ASPxComboBYearL": yearLabel,
          "ASPxPageControl$ASPxComboBKind": kind,
          "ASPxPageControl$ASPxComboBKaisuL": kaisu,
        },
      );

      // Step 4: 会議名一覧を取得
      const nameItems = extractComboItems(
        htmlAfterKaisu,
        "ASPxComboBNameL",
      );

      for (const name of nameItems) {
        const heldOn = extractHeldOn(name);
        if (!heldOn) continue;

        allDocuments.push({
          title: name,
          heldOn,
          kind,
          kaisu,
        });
      }
    }
  }

  return allDocuments;
}
