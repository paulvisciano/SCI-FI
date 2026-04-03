**PR Ready for Review** 🔗

**Title:** feat: memory filter UI - time-based NeuroGraph view + bump to v3.2.0
**PR:** https://github.com/paulvisciano/SCI-FI/pull/new/feature/memory-filter-ui
**Branch:** feature/memory-filter-ui
**Version:** Client v3.2.0

**What Changed:**
- Added time-based filter for NeuroGraph showing recent memories only
- Memory Filter UI appears top-right of NeuroGraph panel
- Filter options: Last 10 minutes, 30 minutes, 24 hours (default), 7 days, All time
- Node count updates dynamically based on filter selection
- Sci-fi styling matches Orb v315 aesthetic (glowing, fluid animations)

**Files:**
- apps/JARVIS/components/memory-filter.jsx - Filter dropdown component
- apps/JARVIS/hooks/use-memory-filter.js - Time-based filtering hook
- apps/JARVIS/styles/memory-filter.css - Futuristic animations
- apps/JARVIS/app.js - Filter integration, v3.2.0 bump
- apps/JARVIS/index.html - Filter UI container, v3.2.0 bump

**Testing:**
- [x] Filter dropdown appears in NeuroGraph UI
- [x] All time ranges work (10m, 30m, 24h, 7d, all)
- [x] Node count updates dynamically
- [x] Sci-fi styling matches Orb v315
- [x] No console errors
- [x] Default: Last 24 hours (not all time)

**Ready for:**
- [ ] Code review (Paul)
- [ ] Merge to preview
- [ ] Merge to production (after preview approval)