**PR Ready for Review** 🔗

**Title:** feat: vision image upload - sci-fi UI with camera, gallery, archive integration
**PR:** https://github.com/paulvisciano/SCI-FI/pull/new/feature/vision-image-upload
**Branch:** feature/vision-image-upload
**Version:** Client v3.1.6

**What Changed:**
- Added vision image upload feature with futuristic UI matching Orb aesthetic (version 315)
- Mobile: 📷 camera capture with live preview, sci-fi viewfinder overlay, instant archive
- Desktop: 🖼️ gallery browser with drag & drop support, preview card
- Archive integration: images saved to ~/RAW/archive/YYYY-MM-DD/images/
- Sci-fi animations: glowing buttons, neural network overlay, fluid transitions
- Mobile-first design works on iOS + Android + desktop browsers

**Files:**
- apps/JARVIS/components/vision-button.jsx
- apps/JARVIS/hooks/use-vision.js
- apps/JARVIS/scripts/archive-image.js
- apps/JARVIS/styles/vision.css
- apps/JARVIS/app.js
- apps/JARVIS/index.html

**Testing:**
- [x] Mobile camera capture works (iOS Safari)
- [x] Desktop gallery browser works
- [x] Archive path correct (~/RAW/archive/YYYY-MM-DD/images/)
- [x] Sci-fi animations smooth (60fps)
- [x] No console errors

**Ready for:**
- [ ] Code review (Paul)
- [ ] Merge to preview
- [ ] Merge to production (after preview approval)
