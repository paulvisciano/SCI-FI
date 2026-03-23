---
name: Two-row time and category filters
overview: "Split the single filter bar into two rows: Row 1 = time (All, Today, Yesterday, This week), Row 2 = category (All, Values, Capabilities, Foundation, Projects, Temporal, Memory links). A node must pass both the selected time and the selected category (AND logic), enabling e.g. \"Temporal neurons for Today\"."
todos: []
isProject: false
---

# Two-row time + category filters for Neuro Graph

## Current behavior

- Single `currentFilter` string; one of: `all`, `today`, `yesterday`, `thisweek`, `value`, `capability`, `foundation`, `project`, `temporal`, `memorylinks`.
- One row of buttons in `[apps/neuro-graph/index.html](apps/neuro-graph/index.html)` inside `#filter-bar`.
- `[nodePassesFilter(n)](apps/neuro-graph/shared/neural-graph.js)` and inline logic in render treat that one value as either time OR category.
- URL: `?filter=X`. Default filter is `today`.

## Target behavior

- **Two independent dimensions:** time and category.
- **Row 1 (time):** All, Today, Yesterday, This week. Values: `all` | `today` | `yesterday` | `thisweek`.
- **Row 2 (category):** All, then category types (Values, Capabilities, Foundation, Projects, Temporal, Memory links). Values: `all` | `value` | `capability` | `foundation` | `project` | `temporal` | `memorylinks` (and any from CONFIG).
- **Combined rule:** Show node only if it passes **both** time and category (e.g. Today + Temporal => `n.isToday && n.type === 'temporal'`).
- URL: `?time=today&category=temporal` (backward compat: single `?filter=` maps into time or category as today).

## 1. HTML – filter bar structure (`[apps/neuro-graph/index.html](apps/neuro-graph/index.html)`)

- Replace the single row of buttons inside `#filter-bar` with two child divs:
  - **Row 1:** `id="filter-row-time"` or class `filter-row filter-row-time`, containing buttons with `data-filter-time="all"`, `"today"`, `"yesterday"`, `"thisweek"`. Labels: All, Today, Yesterday, This week.
  - **Row 2:** `id="filter-row-category"` or class `filter-row filter-row-category`, containing buttons with `data-filter-category="all"`, `"value"`, `"capability"`, `"foundation"`, `"project"`, `"temporal"`, `"memorylinks"`. Labels: All, Values, Capabilities, Foundation, Projects, Temporal, Memory links.
- Keep shared class `filter-btn` for styling; add optional class for row (e.g. `filter-btn-time` / `filter-btn-category`) if needed for JS selectors.

## 2. CSS – two rows and canvas offset (`[apps/neuro-graph/shared/neural-graph.css](apps/neuro-graph/shared/neural-graph.css)`)

- `#filter-bar`: Change to a column flex layout: `display: flex; flex-direction: column; justify-content: center; gap: 6px;` (or similar). Increase height from 50px to ~88px (e.g. `min-height: 88px`) so two rows fit. Keep existing `right: 240px`, padding, border, z-index, overflow-x for each row.
- Add `.filter-row`: `display: flex; align-items: center; gap: 8px; flex-wrap: wrap;` so each row wraps on narrow viewports.
- **Canvas:** Increase `margin-top` from 50px to the new bar height (e.g. 88px or 96px) so the graph starts below the taller bar.

## 3. JS – two filter state variables and URL (`[apps/neuro-graph/shared/neural-graph.js](apps/neuro-graph/shared/neural-graph.js)`)

### 3.1 State and URL

- Replace `currentFilter` with:
  - `currentTimeFilter`: `'all' | 'today' | 'yesterday' | 'thisweek'`
  - `currentCategoryFilter`: `'all' | 'value' | 'capability' | 'foundation' | 'project' | 'temporal' | 'memorylinks'`
- **getFilterFromUrl():** Read `time` and `category` from query. If only legacy `filter` exists: if value is `today`/`yesterday`/`thisweek`/`all` set time and category=all; else set category=filter and time=all. Defaults: e.g. time=`today`, category=`all`.
- **setFilterInUrl(time, category):** Set `url.searchParams.set('time', time)` and `url.searchParams.set('category', category)`; remove if equal to defaults if desired. Replace `setFilterInUrl(filter)` calls with `setFilterInUrl(currentTimeFilter, currentCategoryFilter)`.

### 3.2 Node filter logic

- **nodePassesFilter(n):**
  - Time: `currentTimeFilter === 'all'` OR `(currentTimeFilter === 'today' && n.isToday)` OR yesterday / thisweek analogues.
  - Category: `currentCategoryFilter === 'all'` OR `(currentCategoryFilter === 'memorylinks' && n.isMemoryRef)` OR type match using `(CONFIG.filterToType && CONFIG.filterToType[currentCategoryFilter]) || currentCategoryFilter` compared to `(n.type || '').toLowerCase()`.
  - Return `timePass && categoryPass`.

### 3.3 Setters and button wiring

- **setActiveTimeFilter(time):** Set `currentTimeFilter = time`; update URL; update active state only on time row buttons (`[data-filter-time]`); if selected node no longer passes filter, clear selection and close details; call `populateFilterList()`; optional console log.
- **setActiveCategoryFilter(category):** Same pattern for category row and `currentCategoryFilter`.
- Remove single `setActiveFilter(filter)`. On init: query time row buttons and category row buttons separately; add click listeners that call `setActiveTimeFilter(btn.dataset.filterTime)` and `setActiveCategoryFilter(btn.dataset.filterCategory)`; set initial active class on both rows from `currentTimeFilter` and `currentCategoryFilter`.

### 3.4 All references to currentFilter

- **render()** – `passesFilter(nodeIndex)`: use `nodePassesFilter(nodes[nodeIndex])` (already delegates to nodePassesFilter; ensure it uses the new two-dimension nodePassesFilter). Remove the inline `typeForFilter`/currentFilter branches and rely on `nodePassesFilter` everywhere.
- **Spread (today/yesterday 2D spread):** Change condition from `currentFilter === 'today' || currentFilter === 'yesterday'` to `currentTimeFilter === 'today' || currentTimeFilter === 'yesterday'`.
- **Node drawing loop (lines ~653–660):** Replace the inline filter checks with a single `if (!passesFilter(idx)) return;` (passesFilter will call nodePassesFilter).
- **Label visibility / “All” filter:** The “only show label when selected” rule currently uses `currentFilter === 'all'`. Change to “when both dimensions are all”, e.g. `currentTimeFilter === 'all' && currentCategoryFilter === 'all'`.
- **Console log “Filtering by”:** When setting time or category, log e.g. “Time: today, Category: temporal” and counts (nodes/edges passing both).
- **validFilters():** Remove or replace with `validTimeFilters` / `validCategoryFilters` arrays used only for URL validation.
- **Auto-refresh** (setActiveFilter(currentFilter)): Replace with `setActiveTimeFilter(currentTimeFilter)` and `setActiveCategoryFilter(currentCategoryFilter)` so the applied filters are re-applied after data refresh (state is already correct; just need to refresh list and render).

### 3.5 CONFIG

- No CONFIG change required if category filter values match node types (and memorylinks). If CONFIG has `filterToType` (e.g. values -> value), keep using it in nodePassesFilter for category.

## 4. Files to change (summary)


| File                                                                                   | Changes                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[apps/neuro-graph/index.html](apps/neuro-graph/index.html)`                           | Replace filter-bar content with two rows: time row (All, Today, Yesterday, This week) and category row (All, Values, Capabilities, Foundation, Projects, Temporal, Memory links) with `data-filter-time` and `data-filter-category`. |
| `[apps/neuro-graph/shared/neural-graph.css](apps/neuro-graph/shared/neural-graph.css)` | #filter-bar two-row layout and height; .filter-row; canvas margin-top.                                                                                                                                                               |
| `[apps/neuro-graph/shared/neural-graph.js](apps/neuro-graph/shared/neural-graph.js)`   | Two state vars and URL; nodePassesFilter(time AND category); setActiveTimeFilter/setActiveCategoryFilter; wire both rows; replace every currentFilter read with time+category logic; spread and label rules; auto-refresh call.      |


## 5. Backward compatibility

- Old links with `?filter=today` or `?filter=temporal`: parse in getFilterFromUrl and set the corresponding dimension (time or category), other dimension default (e.g. category=all or time=all).

## 6. Optional polish

- Optional: small labels above each row (“Time” and “Category”) for clarity.
- Ensure mobile: filter bar still scrolls/wraps and canvas margin-top accounts for two rows.

