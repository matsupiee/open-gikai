# DiscussNet Scraper Documentation

This directory contains comprehensive documentation for implementing a web scraper for DiscussNet (会議録検索システム), the most widely used Japanese municipal council meeting record system.

## Documents

### 1. **DiscussNet-scraper-research.md** (Primary Research)
Comprehensive research findings on DiscussNet HTML structure, URL patterns, and implementation feasibility.

**Contains:**
- System overview and adoption statistics
- URL patterns and domain structure
- HTML structure analysis for list and detail pages
- CSS selector patterns (inferred from documentation)
- Known municipalities (5-10 examples)
- Anti-scraping measures and ethical considerations
- Technical stack requirements
- Known issues and workarounds

**Read this if:** You need to understand what DiscussNet is, how it works, and why it's scrapable.

---

### 2. **DiscussNet-implementation-guide.md** (Code Implementation)
Step-by-step implementation guide with concrete TypeScript code examples, ready to integrate into the scraper-worker.

**Contains:**
- Complete file structure
- HTML parser implementation (`scrapers/discussnet.ts`)
  - Type definitions
  - Fetch logic with retry/rate-limiting
  - Meeting list parsing
  - Date parsing (including Japanese year formats)
  - Meeting detail extraction
  - Text normalization
  - Pagination detection
- Queue handler implementation (`handlers/discussnet.ts`)
  - Municipality list processor
  - Individual meeting processor
- Queue message type definitions
- Integration with existing `start-job.ts`
- Unit test examples
- Troubleshooting guide
- Performance optimization strategies

**Read this if:** You're ready to implement the scraper or need concrete code examples.

---

### 3. **DiscussNet-CSS-selector-verification.md** (Field Research Template)
Template and checklist for manual verification of CSS selectors on real DiscussNet sites.

**Contains:**
- Template for documenting verified selectors
- Checklist for 10 sample municipalities
- Common selector variations
- Browser console testing scripts
- Date format variations
- Meeting type classifications
- Research timeline

**Use this if:** You're doing Phase 1 field research to verify selectors on real sites.

---

## Quick Reference

### URL Patterns

**List page:**
```
https://{SUBDOMAIN}.discussnet.jp/g07_kaigirokuichiran.asp?KAIGI_NEN={YEAR}
```

**Detail page:**
```
https://{SUBDOMAIN}.discussnet.jp/g07_kaigiroku.asp?KAIGI_KEY={KEY}
```

### Key Stats

| Metric | Value |
|--------|-------|
| Estimated adoption | 500+ municipalities (~40-50% of all) |
| Scrapability | High (consistent HTML structure) |
| JS required? | No (static HTML) |
| Rate limiting | Moderate (1-3 sec delays recommended) |
| Implementation effort | 1-2 weeks |

### Known Working Domains

- takayama.discussnet.jp (Takayama, Gifu)
- isseljapan.discussnet.jp (Issel, Hyogo)
- minamisatsuma.discussnet.jp (Minami-Satsuma, Kagoshima)
- kobe.discussnet.jp (Kobe, Hyogo)
- chiba.discussnet.jp (Chiba, Chiba)
- saitama.discussnet.jp (Saitama, Saitama)

### Implementation Phases

**Phase 1 (1-2 weeks):** Research & validate
- Verify CSS selectors on 10 real sites
- Document any variations
- Confirm URL patterns

**Phase 2 (1-2 weeks):** Core implementation
- Implement `scrapers/discussnet.ts` parser
- Implement `handlers/discussnet.ts` queue consumer
- E2E testing with 10-100 municipalities

**Phase 3+ (future):** Expansion
- Integrate with `municipalities` table
- Implement DB-Search and other systems
- Scale to full national coverage

## Getting Started

1. **For researchers:** Start with `DiscussNet-scraper-research.md`
2. **For developers:** Start with `DiscussNet-implementation-guide.md`
3. **For field verification:** Use `DiscussNet-CSS-selector-verification.md`

## Key References

- **Main design doc:** `地方自治体議会スクレイピング設計書.md`
- **Existing NDL scraper:** `apps/scraper-worker/src/handlers/ndl.ts`
- **Existing Kagoshima scraper:** `apps/scraper-worker/src/handlers/kagoshima.ts`
- **Local scraper pattern:** `apps/scraper-worker/src/scrapers/local.ts`

## Important Notes

- **Ethics:** Check robots.txt and terms of service before scraping
- **Rate limiting:** Always use polite delays (1-3 seconds minimum)
- **User-Agent:** Set realistic User-Agent with project identifier
- **Duplicate prevention:** Use `externalId` for deduplication

## Status

- **Research:** ✓ Complete
- **Implementation guide:** ✓ Complete
- **Verification template:** ✓ Complete
- **Code implementation:** ⏳ Ready for Phase 2
- **Testing & rollout:** ⏳ Pending Phase 2 completion

---

Last updated: March 2026
Ready for Phase 2 implementation
