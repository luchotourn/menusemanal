# PRD: Issue #51 - Comments Feed in Favorites Page

## Overview

Add a family comments feed to the Favorites page and unify navigation labels across creator and commentator roles.

## Goals

1. Show chronological feed of all family meal comments in a new "Comentarios" tab
2. Unify navigation labels between creator and commentator roles
3. Simplify navigation by removing redundant `/ratings` page

---

## User Stories

### As a parent (creator)
- I want to see all family comments in one place so I can understand meal feedback without checking each day individually
- I want to delete inappropriate comments from the feed

### As a child (commentator)
- I want to see what my family members said about meals
- I want to delete my own comments if I made a mistake

---

## Functional Requirements

### 1. Comments Feed (`/favorites` - Comentarios tab)

| Requirement | Details |
|-------------|---------|
| Visibility | Both creators and commentators can see the feed |
| Data displayed | User name, avatar, emoji reaction, comment text, recipe name, meal date/type, relative timestamp |
| Ordering | Most recent first (descending by createdAt) |
| Limit | 50 comments max |
| Click action | Navigate to recipe detail page |
| Images | No recipe thumbnails (text only for performance) |
| Refresh | Refresh data when navigating to the tab |
| Deletion | Users can delete their own comments (show delete button) |

#### Comment Card Layout

```
┌─────────────────────────────────────────────────┐
│ [Avatar] UserName                    hace 2h  X │
│          🍕 Milanesas - Mar 21, Almuerzo        │
│          ¡Estaba muy rica!                      │
└─────────────────────────────────────────────────┘
```

- Avatar: 40x40px with fallback to first letter
- X button: Only visible on own comments (delete action)
- Clicking card navigates to recipe detail

#### Empty State

```
┌─────────────────────────────────────────────────┐
│         [MessageCircle icon]                    │
│     No hay comentarios todavía                  │
│  ¡Comenta sobre las comidas de la familia!     │
└─────────────────────────────────────────────────┘
```

### 2. Favorites Page Tabs

| Tab | Content |
|-----|---------|
| **Favoritos** | Existing favorite recipes grouped by rating |
| **Comentarios** | New comments feed component |

Default tab: Favoritos

### 3. Unified Navigation

#### Before

| Tab | Creator | Commentator |
|-----|---------|-------------|
| 1 | Semana | Semana |
| 2 | Comidas | Recetas |
| 3 | Favoritas | Estrellas |
| 4 | Ajustes | Perfil |

#### After

| Tab | Both Roles | Path |
|-----|------------|------|
| 1 | Semana | `/` |
| 2 | Comidas | `/recipes` |
| 3 | Favoritos | `/favorites` |
| 4 | Ajustes | `/settings` |

### 4. Remove `/ratings` Page

- Delete `client/src/pages/ratings.tsx`
- Remove route from `client/src/App.tsx`
- No redirect needed (page not linked anywhere after nav change)

---

## Technical Specification

### Backend Changes

#### 1. Storage Layer (`server/storage.ts`)

Add new method to `IStorage` interface:

```typescript
getFamilyComments(familyId: number, limit?: number): Promise<FamilyComment[]>
```

Response type:
```typescript
interface FamilyComment {
  id: number;
  comment: string;
  emoji: string | null;
  createdAt: Date;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  mealPlan: {
    id: number;
    fecha: string;
    tipoComida: string;
  };
  recipe: {
    id: number;
    nombre: string;
  } | null;
}
```

SQL Query (Drizzle ORM):
```typescript
db.select(...)
  .from(mealComments)
  .innerJoin(users, eq(mealComments.userId, users.id))
  .innerJoin(mealPlans, eq(mealComments.mealPlanId, mealPlans.id))
  .leftJoin(recipes, eq(mealPlans.recetaId, recipes.id))
  .where(eq(mealComments.familyId, familyId))
  .orderBy(desc(mealComments.createdAt))
  .limit(limit)
```

#### 2. API Endpoint (`server/routes.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/comments/family` | Required | Get family comments feed |

Query params:
- `limit` (optional): Max comments to return (default 50, max 100)

Response: Array of `FamilyComment` objects

### Frontend Changes

#### 1. New Component: `client/src/components/comments-feed.tsx`

Props: None (fetches data internally)

Features:
- TanStack Query for data fetching
- Loading skeleton (5 placeholder cards)
- Empty state component
- Delete mutation with confirmation
- Click handler to navigate to recipe
- Relative time formatting (Spanish)

#### 2. Modified: `client/src/pages/favorites.tsx`

Changes:
- Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from shadcn/ui
- Import `CommentsFeed` component
- Wrap existing content in `TabsContent value="favoritos"`
- Add new `TabsContent value="comentarios"` with `<CommentsFeed />`

#### 3. Modified: `client/src/components/role-based-navigation.tsx`

Changes to `commentatorNavItems`:
- Line 37: `"Recetas"` → `"Comidas"`
- Line 38: path `/ratings` → `/favorites`, label `"Estrellas"` → `"Favoritos"`, icon `Star` → `Heart`
- Line 39: `"Perfil"` → `"Ajustes"`, icon `User` → `Settings`

Changes to `creatorNavItems`:
- Line 30: `"Favoritas"` → `"Favoritos"`

#### 4. Modified: `client/src/App.tsx`

- Remove `/ratings` route

#### 5. Delete: `client/src/pages/ratings.tsx`

- Remove entire file

---

## Implementation Order

| Step | Task | File |
|------|------|------|
| 1 | Add `desc` import | `server/storage.ts` |
| 2 | Add `getFamilyComments` to interface | `server/storage.ts` |
| 3 | Implement `getFamilyComments` in DatabaseStorage | `server/storage.ts` |
| 4 | Add MemStorage stub | `server/storage.ts` |
| 5 | Add GET `/api/comments/family` endpoint | `server/routes.ts` |
| 6 | Create CommentsFeed component | `client/src/components/comments-feed.tsx` |
| 7 | Add tabs to Favorites page | `client/src/pages/favorites.tsx` |
| 8 | Update navigation labels | `client/src/components/role-based-navigation.tsx` |
| 9 | Remove ratings route | `client/src/App.tsx` |
| 10 | Delete ratings page | `client/src/pages/ratings.tsx` |

---

## Testing Checklist

### Backend
- [ ] API returns comments for authenticated user's family only
- [ ] Comments ordered by createdAt descending
- [ ] Limit parameter works (default 50, max 100)
- [ ] Empty array returned when no comments exist
- [ ] Null recipe handled gracefully (LEFT JOIN)

### Frontend
- [ ] Loading skeleton displays while fetching
- [ ] Empty state displays when no comments
- [ ] Comments display correct data (user, emoji, text, recipe, date)
- [ ] Relative time formatting works in Spanish
- [ ] Delete button only shows on own comments
- [ ] Delete removes comment and refreshes feed
- [ ] Clicking comment navigates to recipe detail
- [ ] Tabs switch correctly between Favoritos and Comentarios
- [ ] Both creator and commentator roles can access page

### Navigation
- [ ] All 4 tabs show "Semana", "Comidas", "Favoritos", "Ajustes" for both roles
- [ ] Commentator navigation goes to correct paths
- [ ] `/ratings` URL returns 404 (page removed)

---

## Out of Scope

- Real-time updates / WebSocket push
- Pagination / infinite scroll (limited to 50 for MVP)
- Comment editing (only delete supported)
- Filtering comments by date/user/recipe
- Recipe thumbnail images in feed

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Query performance with many comments | Limit to 50, add index on `(familyId, createdAt)` if needed |
| Removing `/ratings` breaks bookmarks | Low risk - page was only accessible via nav, no deep linking expected |
| Cache stale after adding comment elsewhere | Invalidate `/api/comments/family` query when comment is added |

---

## Success Metrics

- Parents can view all family feedback in one location
- Reduced navigation complexity (unified labels)
- No increase in page load time for Favorites page
