# DiscussNet CSS Selector Verification Checklist

**Purpose:** Document verified CSS selectors from real DiscussNet municipalities
**Status:** Template - to be filled during Phase 1 research

---

## How to Use This Document

1. Visit a real DiscussNet municipality site
2. Inspect HTML with browser DevTools (F12 → Elements/Inspector)
3. Find the CSS classes/selectors for each element
4. Record them in the appropriate section below
5. Test the selectors in the browser console using:
   ```javascript
   // Test selector
   document.querySelectorAll('your-selector-here')

   // Should return the expected elements
   ```

---

## Sample DiscussNet Municipalities

### Template: Municipality Name / {subdomain}.discussnet.jp

**Research Date:** YYYY-MM-DD
**Researcher:** [Name]
**Notes:** [Any special observations]

#### Meeting List Page (`g07_kaigirokuichiran.asp`)

**URL tested:** `https://{subdomain}.discussnet.jp/g07_kaigirokuichiran.asp`

**Page structure:**
```html
<!-- Describe the overall page structure -->
```

**CSS Selectors Found:**

| Element | Selector | Type | Notes |
|---------|----------|------|-------|
| Meeting list container | | | |
| Meeting row | | | |
| Meeting title/link | | | |
| KAIGI_KEY value | | | |
| Meeting date | | | |
| Meeting type | | | |
| Pagination next link | | | |
| Year/filter form | | | |

**Example extracted data:**
```json
{
  "meeting": {
    "title": "[example]",
    "date": "[example]",
    "type": "[example]",
    "url": "[example]"
  }
}
```

**Pagination behavior:**
- [ ] Uses `?page=N` parameter
- [ ] Uses `?offset=N` parameter
- [ ] Uses different structure (describe)
- [ ] No pagination / single page

#### Meeting Detail Page (`g07_kaigiroku.asp?KAIGI_KEY=...`)

**URL tested:** `https://{subdomain}.discussnet.jp/g07_kaigiroku.asp?KAIGI_KEY=XXXXX`

**Page structure:**
```html
<!-- Describe the overall page structure -->
```

**CSS Selectors Found:**

| Element | Selector | Type | Notes |
|---------|----------|------|-------|
| Page title/heading | | | |
| Meeting date | | | |
| Full content container | | | |
| Session/part header | | | |
| Speech block | | | |
| Speaker name | | | |
| Speaker prefix | | | |
| Speech text | | | |
| Timestamp/break marker | | | |

**Speaker format examples:**
```
[Paste actual speaker lines from HTML]
```

**Special formatting observed:**
- [ ] Full-width spaces (　)
- [ ] HTML entities (`&nbsp;`, `&lt;`)
- [ ] Japanese year format (令和6年 vs 2024年)
- [ ] Special characters/brackets (【】, 「」)
- [ ] Emphasis markers

**Example extracted data:**
```json
{
  "title": "[example]",
  "heldOn": "[example]",
  "speeches": [
    {
      "speaker": "[example]",
      "content": "[example]"
    }
  ]
}
```

---

## Verified Sites (Fill in as you complete research)

### 1. Takayama / takayama.discussnet.jp

**Research Date:** [TBD]

#### List Page Selectors
- Meeting list: `.kaigiroku-list` or `table.list`
- Meeting row: `tbody tr` or `.kaigiroku-row`
- Meeting link: `a[href*="KAIGI_KEY"]`
- Meeting date: `td:nth-child(2)`
- Pagination: `.pagination a.next` or `a:contains("次へ")`

#### Detail Page Selectors
- Title: `h1`
- Content: `.kaigiroku-body` or `#main`
- Speech blocks: `.speech-item` or `div.genpon`
- Speaker: `.speaker` or `span.speaker-name`
- Speech text: `.speech-content` or `p`

**Status:** [ ] Not started [ ] In progress [X] Needs verification

---

### 2. Issel / isseljapan.discussnet.jp

**Research Date:** [TBD]

#### List Page Selectors
- [ ] Verified

#### Detail Page Selectors
- [ ] Verified

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 3. Minami-Satsuma / minamisatsuma.discussnet.jp

**Research Date:** [TBD]

#### List Page Selectors
- [ ] Verified

#### Detail Page Selectors
- [ ] Verified

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 4. [Add municipality 4]

**Research Date:** [TBD]

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 5. [Add municipality 5]

**Research Date:** [TBD]

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 6. [Add municipality 6]

**Research Date:** [TBD]

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 7. [Add municipality 7]

**Research Date:** [TBD]

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 8. [Add municipality 8]

**Research Date:** [TBD]

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 9. [Add municipality 9]

**Research Date:** [TBD]

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

### 10. [Add municipality 10]

**Research Date:** [TBD]

**Status:** [ ] Not started [ ] In progress [ ] Needs verification

---

## Common Variations Observed

### Selector Variations Found

**Meeting list container:**
- `.kaigiroku-list`
- `table.list`
- `table.kaigiroku-list`
- `div.kaigiroku-list`
- `#meeting-list`

**Speech blocks:**
- `.speech-item`
- `.genpon`
- `.kaigiroku-row`
- `table.speech-table tr`
- `div.speech-block`

**Speaker identification:**
- `.speaker`
- `.genpon-name`
- `.speaker-name`
- `td:first-child` (in table)
- `span.person`

**Content container:**
- `.kaigiroku-body`
- `#main`
- `main`
- `.content`
- `.article-content`

### Date Format Variations

**Japanese year (和暦):**
- 令和6年3月15日 → 2024-03-15 (Reiwa)
- 平成31年3月15日 → 2019-03-15 (Heisei)
- 昭和64年3月15日 → 1989-03-15 (Showa)

**Western year:**
- 2024年3月15日 → 2024-03-15
- 2024/3/15 → 2024-03-15
- 2024-03-15 → 2024-03-15 (already ISO)

**Numeric formats:**
- Full-width: ２０２４年３月１５日 (needs normalization)
- Leading zeros: 2024年3月15日 vs 2024年03月15日

### Meeting Type Variations

| Type | Japanese | Classification |
|------|----------|-----------------|
| Plenary | 本会議 | plenary |
| Committee | 委員会 | committee |
| Extraordinary | 臨時会 | plenary |
| Regular | 定例会 | plenary |
| Budget | 予算決算委員会 | committee |
| Special | 特別委員会 | committee |
| General Affairs | 総務委員会 | committee |
| Welfare | 福祉委員会 | committee |

---

## Browser Console Testing Scripts

### Test Meeting List Parsing

```javascript
// Paste this into browser console on a DiscussNet list page

// Find all meeting rows
const meetings = document.querySelectorAll('tbody tr, .kaigiroku-row');
console.log(`Found ${meetings.length} meeting rows`);

// Extract data from first meeting
if (meetings.length > 0) {
  const firstRow = meetings[0];
  const link = firstRow.querySelector('a[href*="KAIGI_KEY"]');
  const date = firstRow.querySelector('td:nth-child(2)');
  const type = firstRow.querySelector('td:nth-child(3)');

  console.log({
    link: link?.textContent,
    url: link?.href,
    date: date?.textContent,
    type: type?.textContent
  });
}

// Show all detected selectors
const listContainer = document.querySelector('.kaigiroku-list, table.list, #meeting-list');
console.log('List container classes:', listContainer?.className);
console.log('List container id:', listContainer?.id);
```

### Test Meeting Detail Parsing

```javascript
// Paste this into browser console on a DiscussNet detail page

// Find content areas
const body = document.querySelector('.kaigiroku-body, #main, main, .content');
console.log('Content container found:', !!body);

// Find first speech block
const speeches = document.querySelectorAll('.speech-item, .genpon, .kaigiroku-row');
console.log(`Found ${speeches.length} speech blocks`);

if (speeches.length > 0) {
  const first = speeches[0];
  const speaker = first.querySelector('.speaker, .genpon-name, .speaker-name, td:first-child');
  const content = first.querySelector('.speech-content, .genpon-content, td:last-child, p');

  console.log({
    speaker: speaker?.textContent?.trim(),
    content: content?.textContent?.trim().substring(0, 100)
  });
}

// Test date parsing
const titleEl = document.querySelector('h1, h1.title, .kaigiroku-title');
console.log('Page title:', titleEl?.textContent?.trim());
```

### Test Pagination

```javascript
// Paste this into browser console on a DiscussNet list page

// Find next page links
const nextLinks = document.querySelectorAll(
  'a.next, a[title*="次"], a:contains("次へ"), .pagination a:last-child'
);
console.log(`Found ${nextLinks.length} potential next links`);

// Check for pagination by looking at URL params
const url = new URL(window.location);
const page = url.searchParams.get('page');
console.log('Current page:', page || 1);

// Try to find next page by URL pattern
const allPageLinks = Array.from(document.querySelectorAll('a[href*="page="], a[href*="offset="]'));
console.log('Page parameter links:', allPageLinks.map(a => a.href));
```

---

## Summary Checklist

After verifying 10 municipalities:

- [ ] Meeting list selectors are consistent across 80%+ of sites
- [ ] Detail page selectors are consistent across 80%+ of sites
- [ ] Date parsing handles all observed formats
- [ ] Meeting type classification works for all observed types
- [ ] Pagination detection works for all observed patterns
- [ ] Speaker name extraction works correctly
- [ ] No blocking or access issues on tested sites
- [ ] Response times are acceptable (< 5s per page)
- [ ] HTML encoding/special characters handled correctly
- [ ] All gathered data has been documented

---

## Research Timeline

**Phase 1 Goal:** Complete this checklist with 10 verified municipalities

| Milestone | Target Date | Status |
|-----------|------------|--------|
| Identify 10 municipalities | [TBD] | [ ] |
| Verify list page selectors | [TBD] | [ ] |
| Verify detail page selectors | [TBD] | [ ] |
| Test pagination | [TBD] | [ ] |
| Document variations | [TBD] | [ ] |
| Finalize selectors for code | [TBD] | [ ] |

---

## Notes for Implementation

**After completing this verification:**

1. Update `scrapers/discussnet.ts` with finalized selectors
2. Create test fixtures with sample HTML from each site
3. Add unit tests with real-world HTML samples
4. Document any site-specific quirks in handler comments

**Common pitfalls to watch:**

- Don't assume all sites use exact same CSS classes
- Some sites may use different table structures
- Text content may have leading/trailing spaces
- Date formats can vary within a single site
- JavaScript may be rendering some content (avoid those)

---

**Document Status:** Template (awaiting Phase 1 research completion)
**Last Updated:** [TBD]
**Researcher(s):** [TBD]
