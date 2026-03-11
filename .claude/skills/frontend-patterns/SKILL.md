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

## Component Placement Rules

- **ページ固有のコンポーネント**は必ず `routes/xxx/_components/` 内に置く
- **`shared/_components/`** は複数の機能・ページで使われる汎用コンポーネントのみ。単一ページにしか使わないコンポーネントは置かない

## Standard Page Structure

routes/xxx/
├── page.tsx
├── \_components/ # このページ専用のコンポーネント（他ページで使わないもの）
│ ├── component-a.tsx
│ └── component-b.tsx
├── \_hooks/ # Page-specific hooks
│ ├── useData.ts
│ └── useActions.ts
├── \_contexts/ # React contexts (if needed)
│ └── form-context.tsx
└── \_utils/ # Page-specific utilities
│ └── helpers.ts

shared/
└── \_components/ # 複数の機能・ページをまたいで使われる汎用コンポーネントのみ
    ├── header.tsx
    └── ...

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
