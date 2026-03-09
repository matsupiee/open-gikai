---
name: frontend-patterns
description: frontend-patterns which should be referred
version: 1.0.0
---

# Frontend Patterns

Frontend patterns

## File Organization Philosophy

**ドメイン単位の縦割り構成**: Domain-driven vertical structure, NOT technical layer separation.

Each feature/page owns its UI, hooks, schemas, and utils. Related files must be placed together.

## Standard Page Structure

{route}/
├── page.tsx
├── \_components/ # Page-specific components
│ ├── component-a.tsx
│ └── component-b.tsx
├── \_hooks/ # Page-specific hooks
│ ├── useData.ts
│ └── useActions.ts
├── \_contexts/ # React contexts (if needed)
│ └── form-context.tsx
└── \_utils/ # Page-specific utilities
│ └── helpers.ts

CRITICAL: When placing form fields horizontally, ALWAYS add items-start.

```typescript
// ✅ CORRECT: items-start added

<div className="grid grid-cols-3 gap-4 items-start">
  <FormField>...</FormField>
  <FormField>...</FormField>
  <FormField>...</FormField>
</div>

// ❌ WRONG: No items-start

<div className="grid grid-cols-3 gap-4">
  <FormField>...</FormField>
  <FormField>...</FormField>
  <FormField>...</FormField>
</div>
```

Reason: When FormMessage displays errors, field height increases. Without items-start, fields without errors will shift vertically due to default stretch alignment.

---

Generated from git history analysis - 2026-02-15
