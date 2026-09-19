# Marketing Studio — Full Website Audit & Remediation Report

**Date:** March 19, 2026  
**Auditor:** Antigravity AI  
**Scope:** Full-stack Client & Routing Audit (34 Routes, 3 Viewports: Desktop 1440x900, Tablet 768x1024, Mobile 375x812)  
**Deliverable:** `WEBSITE_AUDIT.md` (Project Root)  
**Status:** Complete — Evidence-Based (Zero Code Changes Applied During Audit)

---

## 1. Executive Summary

Marketing Studio was constructed at high velocity to orchestrate a complex generative AI media workspace: combining character identity generation (FLUX.2, Qwen), image/video template transformation (FaceFusion, LTX-Video, Kling, Seedance), a 4-step AI documentary pipeline, audio synthesis (Kokoro TTS, Suno AI music, SFX), an in-browser timeline NLE, and Model Context Protocol (MCP) tool integration.

Because features were rapidly added and styled across separate development sessions, the codebase has accumulated clear structural and visual friction points. The underlying issues stem not from a single failing script, but from **three architectural root causes**:

1. **CSS Cascade & Contrast Inversion Collisions:**  
   The application transitioned from a dark theme (`#150f23`) to a warm cream canvas (`#f7f5f0`). During a recent styling pass (`product-polish.css`), a universal contrast rule intended to ensure high readability on parrot green backgrounds applied `color: #150f23 !important;` to `.btn.lime` without enforcing a lime background (`background: var(--lime)`). Because `.btn.lime` was originally defined in `styles.css` with a dark navy background (`#150f23`), the combined cascade resulted in **invisible black text on black buttons** across critical conversion points: Pricing checkout buttons, the MCP endpoint copy button, and Library empty-state CTAs. Concurrently, Documentaries hero headings remained hardcoded in near-white (`#fffdf8 !important`), washing out completely against the cream page background.

2. **Mobile Layout Stack Overflow & Lack of Responsive Drawer:**  
   The primary navigation (`Nav.tsx`) renders 8 full dropdown menus, plus Auth, Pricing, Library, and a prominent CTA. On screens narrower than 700px, rather than collapsing into a responsive slide-over drawer or hamburger menu, the CSS merely wraps all elements into the document flow. On a standard 375px mobile viewport, the header forms **5 stacked rows consuming 220px–260px (nearly 40% of the screen height)** before page content can begin, while the 11 Audio desk buttons wrap into a 6-row block.

3. **State Detachment & Route Decoupling:**  
   Components frequently maintain independent local states that do not synchronize across navigation boundaries. For example, selecting an AI model engine on the `/images-templates` or `/video-templates` catalog strip is discarded upon clicking "Generate", resetting the subsequent detail workspace to default. Similarly, generated audio assets remain trapped in `/audio` and never appear in the unified `/library`, while unmatched URLs silently render Avatar Studio without rendering a 404 page.

The following sections provide an exhaustive, evidence-based accounting of every route, visual verification, concrete code locations, and a phased remediation plan.

---

## 2. Full Route Coverage Inventory

The audit examined all 34 routes across three viewports (Desktop 1440x900, Tablet 768x1024, Mobile 375x812) using headless Chromium rendering, live DOM inspection, and static code analysis.

| Route ID | Path / URL | Associated Source Files | Viewports Tested | Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R01** | `/` (Landing) | `apps/frontend/src/landing/Landing.tsx`, `BrandMark.tsx`, `Mascots.tsx`, `StudioReel.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Mobile nav wrap) |
| **R02** | `/avatar` | `apps/frontend/src/App.tsx`, `avatar-studio.css` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R03** | `/images-templates` | `apps/frontend/src/ImagesTemplates.tsx`, `ModelStrip.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Model choice lost on open) |
| **R04** | `/video-templates` | `apps/frontend/src/VideoTemplates.tsx`, `ModelStrip.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Model choice lost on open) |
| **R05** | `/effects` | `apps/frontend/src/VideoTemplates.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Navbar pack links do not filter) |
| **R06** | `/projects` (Documentaries) | `apps/frontend/src/projects/DocumentaryFlow.tsx`, `documentary.css` | 1440, 768, 375 | Visual + DOM + Code | **Critical** (White-on-cream hero, reversed columns) |
| **R07** | `/library` | `apps/frontend/src/Library.tsx`, `Lightbox.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Critical** (Invisible button text, missing audio) |
| **R08** | `/audio?desk=tts` | `apps/frontend/src/Audio.tsx`, `audio-ui.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Mobile button wrap, pink warning banner) |
| **R09** | `/audio?desk=voices` | `apps/frontend/src/Audio.tsx`, `VoiceLibrary.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R10** | `/audio?desk=change` | `apps/frontend/src/Audio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Submit button black-on-black) |
| **R11** | `/audio?desk=dub` | `apps/frontend/src/Audio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R12** | `/audio?desk=clone` | `apps/frontend/src/Audio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R13** | `/audio?desk=dialogue` | `apps/frontend/src/Audio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R14** | `/audio?desk=dictionary` | `apps/frontend/src/Audio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R15** | `/audio?desk=isolate` | `apps/frontend/src/Audio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R16** | `/audio?desk=stt` | `apps/frontend/src/Audio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R17** | `/audio?desk=sfx` | `apps/frontend/src/Audio.tsx`, `AudioLibrary.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Submit button black-on-black) |
| **R18** | `/audio?desk=music` | `apps/frontend/src/Audio.tsx`, `AudioLibrary.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Submit button black-on-black) |
| **R19** | `/mcp` | `apps/frontend/src/Mcp.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Critical** (Copy URL button black-on-black) |
| **R20** | `/pricing` | `apps/frontend/src/Pricing.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Critical** (All pricing tier buttons black-on-black) |
| **R21** | `/contact` | `apps/frontend/src/Contact.tsx`, `Shell.tsx` | 1440, 768, 375 | Visual + DOM + Code | **High** (Hard-gated behind Google OAuth) |
| **R22** | `/login` | `apps/frontend/src/LoginGate.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R23** | `/terms` | `apps/frontend/src/Policy.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R24** | `/refund` | `apps/frontend/src/Policy.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R25** | `/delivery` | `apps/frontend/src/Policy.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R26** | `/cancellation` | `apps/frontend/src/Policy.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** |
| **R27** | `/studio` | `apps/frontend/src/Shell.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Pass** (Redirects cleanly to `/projects`) |
| **R28** | `/images-templates/:id` | `apps/frontend/src/TemplateStudio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (FOUC on initial catalog load) |
| **R29** | `/video-templates/:id` | `apps/frontend/src/TemplateStudio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (FOUC on initial catalog load) |
| **R30** | `/effects/:id` | `apps/frontend/src/TemplateStudio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (FOUC on initial catalog load) |
| **R31** | `/projects/:id` (Script) | `apps/frontend/src/projects/DocumentaryFlow.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Raw unauthenticated empty message) |
| **R32** | `/projects/:id/cast` | `apps/frontend/src/projects/DocumentaryFlow.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Raw unauthenticated empty message) |
| **R33** | `/projects/:id/studio` | `apps/frontend/src/video-studio/VideoStudio.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Warning** (Dark unstyled unauthenticated screen) |
| **R34** | `/*` (Unmatched Route) | `apps/frontend/src/Nav.tsx`, `Shell.tsx` | 1440, 768, 375 | Visual + DOM + Code | **Medium** (Silent fallback to Avatar; no 404) |

---

## 3. Findings by Severity

### Critical Severity

#### Finding AUDIT-01: Invisible Black-on-Black Button Text Across Core Call-to-Actions
- **Finding ID:** `AUDIT-01`
- **Affected Route(s):** `/pricing` (R20), `/mcp` (R19), `/library` (R07), `/images-templates/:id` (R28), `/video-templates/:id` (R29), `/effects/:id` (R30), `/audio` (R08, R10, R17, R18).
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/styles.css` lines 682–688
  - `apps/frontend/src/product-polish.css` lines 21–29
  - `apps/frontend/src/Pricing.tsx` lines 226, 236, 258, 275
  - `apps/frontend/src/Mcp.tsx` line 74
  - `apps/frontend/src/Library.tsx` line 139
  - `apps/frontend/src/TemplateStudio.tsx` lines 290, 385
  - `apps/frontend/src/Audio.tsx` lines 480, 573, 782
- **Steps to Reproduce:**
  1. Open `http://127.0.0.1:5173/pricing` on desktop or mobile.
  2. Scroll down to the pricing cards. Inspect the buttons on the Pro and Premium tiers ("Sign in to get Pro", "Get Premium", or "Current plan").
  3. Open `http://127.0.0.1:5173/mcp` and inspect the "Copy endpoint URL" button under "Hosted Endpoint".
  4. Open `http://127.0.0.1:5173/library` with no generated assets and inspect the "Create your first avatar" empty state button.
- **Observed Behavior:**
  Buttons appear as solid dark navy/black rectangles (`#150f23`) with a thin lime border and **completely invisible black text** (`color: #150f23 !important`). The button labels cannot be read by sighted users.
- **Expected Behavior:**
  Primary action buttons should have a high-contrast lime green background (`#c2ef4e`) with bold dark navy text (`#150f23`), making the label immediately legible and inviting clicks.
- **User Impact:**
  Direct blocker for user conversion and engagement. Prospective paying customers cannot see how to purchase or sign up for plans on `/pricing`. Users on `/mcp` cannot see what the action button does.
- **Likely Root Cause:**
  `styles.css` originally defined `.btn.lime` as a dark button with lime text:
  ```css
  .btn.lime { background: #150f23; color: #c2ef4e; ... }
  ```
  Later, `product-polish.css` introduced a "Parrot Green Contrast Rule":
  ```css
  :is(.hf-btn-lime, .btn.lime, .btn-lime, .project-primary, .chip-lime, ...) {
    color: #150f23 !important;
    -webkit-text-fill-color: #150f23 !important;
  }
  ```
  The author assumed `.btn.lime` already had a lime background. Because `product-polish.css` did not explicitly set `background: var(--lime) !important;`, `.btn.lime` inherited `background: #150f23` from `styles.css` and `color: #150f23 !important` from `product-polish.css`, causing dark text on a dark background.
- **Concrete Recommended Fix:**
  In `apps/frontend/src/product-polish.css` (lines 24–29), ensure the background is explicitly declared alongside the forced text color:
  ```css
  :is(.hf-btn-lime, .btn.lime, .btn-lime, .project-primary, .chip-lime, .film-length-pill.on, button.film-step.on, .nav .nav-cta) {
    background: var(--lime) !important;
    color: #150f23 !important;
    -webkit-text-fill-color: #150f23 !important;
    border-color: var(--lime) !important;
  }
  :is(.hf-btn-lime, .btn.lime, .btn-lime, .project-primary, .chip-lime):hover:not(:disabled) {
    background: #d6f874 !important;
  }
  ```

---

#### Finding AUDIT-02: Low-Contrast / Near-Invisible Header Text on Documentaries Page
- **Finding ID:** `AUDIT-02`
- **Affected Route(s):** `/projects` (R06)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/projects/DocumentaryFlow.tsx` lines 110–127
  - `apps/frontend/src/projects/documentary.css` lines 152–184
- **Steps to Reproduce:**
  1. Open `http://127.0.0.1:5173/projects`.
  2. Inspect the hero banner directly above the stage card ("DOCUMENTARIES / Documentary Studio / Full AI pipeline...").
- **Observed Behavior:**
  The page background is light cream (`#f7f5f0`). The H1 title `Documentary Studio` is rendered in near-white (`#fffdf8 !important`), the kicker is lime (`#c2ef4e !important`), and the lede description is light lavender (`#cfc8d6 !important`). All three text elements severely wash out against the light cream background, failing WCAG 2.1 AA (contrast ratio < 1.3:1).
- **Expected Behavior:**
  The hero title should render in high-contrast dark navy (`#150f23`), the kicker in deep violet/plum (`#4b3e70`), and the lede in legible muted slate (`#4b4259`).
- **User Impact:**
  Visitors arriving on the Documentaries feature cannot read the primary page headline or the description explaining what the AI documentary engine does.
- **Likely Root Cause:**
  `documentary.css` lines 162, 174, and 180 styled `.films-hero` with `!important` text colors designed for an all-dark page background. When the application canvas moved to cream (`#f7f5f0`), these overrides were not updated.
- **Concrete Recommended Fix:**
  In `apps/frontend/src/projects/documentary.css` (lines 161–183), update the text colors for `.films-hero`:
  ```css
  .films-hero .kicker {
    color: #4b3e70 !important;
    font-weight: 700;
  }
  .films-hero h1 {
    color: #150f23 !important;
  }
  .films-hero p,
  .films-hero .lede {
    color: #4b4259 !important;
  }
  .films-hero .film-library-jump-btn {
    border-color: #d8d2c4 !important;
    color: #150f23 !important;
  }
  ```

---

### High Severity

#### Finding AUDIT-03: Mobile Header Stack Overflow & Missing Responsive Drawer Navigation
- **Finding ID:** `AUDIT-03`
- **Affected Route(s):** All routes (R01–R34) on viewports < 700px (e.g. 375x812 mobile)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Nav.tsx` lines 429–483
  - `apps/frontend/src/styles.css` lines 2197–2225
  - `apps/frontend/src/product-polish.css` lines 9–20
- **Steps to Reproduce:**
  1. Open any page (e.g. `http://127.0.0.1:5173/` or `/avatar`) in responsive device emulation mode (375px width).
  2. Inspect the header area.
- **Observed Behavior:**
  There is no hamburger menu or mobile drawer. Instead, all 8 top-level dropdown items (`AVATARS`, `IMAGES`, `VIDEOS`, `DOCUMENTARIES`, `AUDIO`, `STUDIO`, `EFFECTS`, `MCP`) along with `SIGN IN`, `PRICING`, `LIBRARY`, and `START CREATING` wrap into 4 to 5 lines of raw buttons. The header takes up **220px to 260px (nearly 40% of the screen height)**. Tapping any dropdown item opens an absolute-positioned menu that overflows or clips outside the screen.
- **Expected Behavior:**
  On screens <= 768px, the header should feature only the BrandMark, an Auth icon, and a clean hamburger icon (`☰`). Tapping the icon should open an off-canvas drawer or modal navigation sheet with clear touch targets.
- **User Impact:**
  Severe usability degradation on all mobile devices. Page content is pushed far below the initial fold, and users frequently trigger unwanted dropdown overlays when attempting to scroll or tap links.
- **Likely Root Cause:**
  `styles.css` lines 2197–2225 simply set `.nav nav { grid-column: 1 / -1; justify-content: center; }` without implementing a collapsible navigation pattern for mobile viewports.
- **Concrete Recommended Fix:**
  Add a state `isMobileMenuOpen` in `Nav.tsx`, render a hamburger button visible only under `@media (max-width: 768px)`, and move `MENUS`, `Pricing`, and `Library` into an accessible slide-over `<aside className="mobile-drawer">` with a backdrop overlay.

---

#### Finding AUDIT-04: Inverted CSS Grid Column Order on Documentaries Creation Stage
- **Finding ID:** `AUDIT-04`
- **Affected Route(s):** `/projects` (R06)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/projects/DocumentaryFlow.tsx` lines 135–245
  - `apps/frontend/src/product-polish.css` lines 145–148
- **Steps to Reproduce:**
  1. Navigate to `http://127.0.0.1:5173/projects`.
  2. Observe the layout of "Topic / Script" versus "Story setup".
- **Observed Behavior:**
  In JSX (`DocumentaryFlow.tsx`), `.film-topic-col-left` (containing Topic / Script input) is placed first, and `.film-topic-col-right` (Story setup, duration pills, story name) is placed second. However, in `product-polish.css`, lines 146–147 apply:
  ```css
  .film-topic-col-right { order: 1; }
  .film-topic-col-left { order: 2; }
  ```
  This visually pushes "Story setup" to the left and "Topic / Script" to the right, inverting the intended layout and creating a mismatch between visual layout and DOM focus order.
- **Expected Behavior:**
  The primary prompt/script drafting area should sit on the left (`order: 1` / DOM first), while secondary controls (duration, presets, naming) sit on the right (`order: 2`), ensuring keyboard Tab navigation matches visual reading order (WCAG 2.4.3).
- **User Impact:**
  Keyboard accessibility failure and confusing visual hierarchy for users following standard left-to-right creation workflows.
- **Likely Root Cause:**
  A temporary CSS rule was applied to reverse the columns without restructuring the JSX or aligning with the user's specification.
- **Concrete Recommended Fix:**
  Remove `.film-topic-col-right { order: 1; }` and `.film-topic-col-left { order: 2; }` from `apps/frontend/src/product-polish.css`. Let the standard DOM order govern column placement.

---

#### Finding AUDIT-05: Redundant Navbar Dropdowns and Broken Sub-Link Destinations
- **Finding ID:** `AUDIT-05`
- **Affected Route(s):** All routes (`Nav.tsx`)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Nav.tsx` lines 71–231
- **Steps to Reproduce:**
  1. Open the "Effects" dropdown in the navbar.
  2. Click any of the 8 pack links ("Incline", "Stop World", "Clones", "Vanish", "Act Natural", "Frozen in Motion", "Studio Slide").
  3. Open the "Images" dropdown and click "Create avatar" or "Text to Image".
  4. Open the "Videos" dropdown and click "Text to Video".
- **Observed Behavior:**
  - In the "Effects" menu, all 8 links route to `/effects` with identical behavior. None deep-link, scroll, or filter to the specific pack.
  - In the "Images" menu, both "Create avatar" and "Text to Image" link to `/avatar` (the Avatar Studio), duplicating the top-level "Avatars" menu item.
  - In the "Videos" menu, "Text to Video" links to `/projects` (Documentaries), creating circular navigation paths.
  - The primary navbar CTA button (line 534) is hardcoded to "Create Avatar" across almost all pages, even when the user is in Video Templates, Library, or Pricing.
- **Expected Behavior:**
  Sub-menu links should navigate to dedicated filter states (e.g. `/effects?pack=incline`), duplicate links pointing to other top-level features should be streamlined, and the main navbar CTA should remain context-aware or lead directly to the main project workflow ("Start Creating").
- **User Impact:**
  Confuses users who expect to browse a specific effect or capability and instead get redirected to general root listings.
- **Likely Root Cause:**
  Marketing copy for sub-items was drafted into the navigation tree without wiring up query parameter filters or anchor links.
- **Concrete Recommended Fix:**
  Wire up pack query params in `Nav.tsx` (e.g., `href: "/effects?pack=incline"`) and consume them in `VideoTemplates.tsx`, or simplify redundant menu links.

---

#### Finding AUDIT-06: Static Contact Page Hard-Gated Behind Google Login
- **Finding ID:** `AUDIT-06`
- **Affected Route(s):** `/contact` (R21)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Shell.tsx` lines 140–146, 255–256
  - `apps/frontend/src/Contact.tsx` lines 1–35
- **Steps to Reproduce:**
  1. In an incognito browser session (or after logging out), navigate directly to `http://127.0.0.1:5173/contact`.
- **Observed Behavior:**
  The user is immediately redirected to `/login?next=%2Fcontact`. Unauthenticated visitors cannot view the contact email (`chaudaryfarhann@gmail.com`) or support instructions without authorizing their Google account.
- **Expected Behavior:**
  The Contact Us page contains purely informational static text and a `mailto:` link; it should be publicly accessible to all users, especially prospective customers with pre-sales or billing questions who do not yet have an account.
- **User Impact:**
  Prospective leads and users experiencing account or payment lockouts are prevented from contacting support.
- **Likely Root Cause:**
  In `Shell.tsx`:
  ```tsx
  if (route.name !== "contact" || user === undefined || user) return;
  setRoute({ name: "login" });
  ```
  An auth gate was accidentally added to `/contact` during route setup.
- **Concrete Recommended Fix:**
  Remove the contact auth redirect effect in `apps/frontend/src/Shell.tsx` (lines 140–146), and render `<Contact />` directly without checking `user`:
  ```tsx
  : route.name === "contact" ? (
    <Contact />
  )
  ```

---

### Medium Severity

#### Finding AUDIT-07: Model Engine Selection Discarded on Navigation to Template Studio
- **Finding ID:** `AUDIT-07`
- **Affected Route(s):** `/images-templates` -> `/images-templates/:id` (R03 -> R28), `/video-templates` -> `/video-templates/:id` (R04 -> R29)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/ImagesTemplates.tsx` lines 23, 54, 79
  - `apps/frontend/src/VideoTemplates.tsx` lines 28, 62, 94
  - `apps/frontend/src/Shell.tsx` lines 177, 197, 217
  - `apps/frontend/src/TemplateStudio.tsx` lines 54–56
- **Steps to Reproduce:**
  1. Open `http://127.0.0.1:5173/images-templates`.
  2. In the "Image models" selector strip, click "Qwen Image Edit" or "Seedream 4.5".
  3. Click "Generate" on any template card.
  4. Observe the selected model card in the resulting `TemplateStudio` view.
- **Observed Behavior:**
  The model selected on the catalog page is completely ignored. `TemplateStudio` initializes its own local state to `IMAGE_MODELS[0]?.id` (`FLUX.2 Klein`), silently resetting the user's choice.
- **Expected Behavior:**
  The model engine chosen in the catalog should carry over to the studio workspace (e.g. passed via URL query param `?engine=qwen-image-edit` or route state).
- **User Impact:**
  Users generate assets using a different AI model than the one they specifically selected in the catalog, wasting generation credits and producing unexpected outputs.
- **Likely Root Cause:**
  `ImagesTemplates.tsx` and `VideoTemplates.tsx` hold `engine` in local state but only pass `templateId` to `onOpen(t.id)`. `TemplateStudio.tsx` does not accept an `engine` prop or inspect URL search parameters.
- **Concrete Recommended Fix:**
  Update `onOpen` in `ImagesTemplates.tsx` and `VideoTemplates.tsx` to pass `(t.id, engine)`, append `?engine=${engine}` to the URL in `Shell.tsx`, and initialize `engine` state in `TemplateStudio.tsx` from the URL search param.

---

#### Finding AUDIT-08: Flash of Unstyled / Broken Content on Direct Template Detail Page Loads
- **Finding ID:** `AUDIT-08`
- **Affected Route(s):** `/images-templates/:id` (R28), `/video-templates/:id` (R29), `/effects/:id` (R30)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/TemplateStudio.tsx` lines 148–215
- **Steps to Reproduce:**
  1. Navigate directly to `http://127.0.0.1:5173/images-templates/1765360204383-1ci042-1b3b9a6717aab1c6f9fc0068aac1becadb4d037b522eb47cf359437d908456a6`.
  2. Observe the page during the initial fetch.
- **Observed Behavior:**
  While `catalog === null`, line 148 (`if (catalog && !template)`) evaluates to false. The component proceeds to render with `template === null`, rendering `<video src={undefined} poster={undefined}>` or `<img src={undefined}>` and generating 404/invalid URI warnings before popping into existence once the catalog arrives.
- **Expected Behavior:**
  If `catalog === null`, `TemplateStudio` should render a smooth `<LoadingScreen />` or skeleton placeholder.
- **User Impact:**
  Visual layout shift (CLS) and console errors when opening template links directly.
- **Likely Root Cause:**
  The guard clause only checked for `catalog && !template`, missing the loading state when `catalog` is still `null`.
- **Concrete Recommended Fix:**
  Add an explicit loading guard in `TemplateStudio.tsx`:
  ```tsx
  if (!catalog) {
    return (
      <main className="studio">
        <LoadingScreen />
      </main>
    );
  }
  ```

---

#### Finding AUDIT-09: Audio Studio Generations Omitted from Main User Library
- **Finding ID:** `AUDIT-09`
- **Affected Route(s):** `/library` (R07), `/audio` (R08–R18)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Library.tsx` lines 68–106
  - `apps/frontend/src/AudioLibrary.tsx` lines 1–120
- **Steps to Reproduce:**
  1. Generate a TTS narration clip, sound effect, or Suno music track in `/audio`.
  2. Click "Library" in the top navigation.
- **Observed Behavior:**
  The page title claims "Everything you have generated", but it only loads `/api/faceswaps` and `/api/studio/projects`. Audio generations are completely invisible in `/library` and can only be accessed from within the `/audio` desk view.
- **Expected Behavior:**
  The Library should contain tabs or filter chips for "All", "Visuals", "Documentaries", and "Audio", unifying all user assets in one persistent location.
- **User Impact:**
  Users believe their generated audio has failed or disappeared after navigating away from `/audio`.
- **Likely Root Cause:**
  Audio desks were built as a standalone module (`AudioLibrary.tsx`) and never linked into the global `Library.tsx` data queries.
- **Concrete Recommended Fix:**
  Import and integrate audio job history into `Library.tsx`, providing a filterable tab for audio assets with inline play/download controls.

---

#### Finding AUDIT-10: Silent Route Fallback on 404 Instead of Error / Not Found Page
- **Finding ID:** `AUDIT-10`
- **Affected Route(s):** Any invalid or mistyped URL (e.g. `/audit-test-404`, `/prcing`)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Nav.tsx` line 276
  - `apps/frontend/src/Shell.tsx` lines 269–271
- **Steps to Reproduce:**
  1. Enter `http://127.0.0.1:5173/nonexistent-route-audit-test` in the browser.
- **Observed Behavior:**
  `pathToRoute` in `Nav.tsx` executes fallback `return { name: "avatar" };`. The browser silently displays Avatar Studio while retaining the invalid URL in the address bar. No 404 indication is given.
- **Expected Behavior:**
  The application should display a dedicated 404 Not Found screen with a helpful message and a button to return home (`/`).
- **User Impact:**
  Users with broken or mistyped links are confused why they are looking at "Avatar Studio" instead of an error message explaining that the URL is invalid.
- **Likely Root Cause:**
  `pathToRoute` defaults unmatched strings to `{ name: "avatar" }` without distinguishing between valid routes and unknown paths.
- **Concrete Recommended Fix:**
  Add a `{ name: "not-found" }` route type, return it when no regex or path matches, and render a styled 404 component in `Shell.tsx`.

---

### Low Severity

#### Finding AUDIT-11: Blocking Synchronous `window.confirm` for Critical Actions
- **Finding ID:** `AUDIT-11`
- **Affected Route(s):** `/library` (R07), `/auth` prompts
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Library.tsx` line 108
  - `apps/frontend/src/auth.ts` lines 46–50
- **Steps to Reproduce:**
  1. Click "Delete" on any item in the user library.
  2. Observe the browser dialog.
- **Observed Behavior:**
  A native browser `window.confirm` dialog blocks JavaScript execution.
- **Expected Behavior:**
  A non-blocking, keyboard-accessible React modal dialog (`<dialog>` or portal modal) styled with the brand aesthetic.
- **User Impact:**
  Disrupts accessibility, cannot be themed, and is automatically suppressed or blocked by certain mobile in-app webviews.
- **Likely Root Cause:**
  Fast prototype convenience call.
- **Concrete Recommended Fix:**
  Replace `window.confirm` with an accessible React modal dialog component.

---

#### Finding AUDIT-12: Raw Unstyled Placeholder Text on Unauthenticated Studio Access
- **Finding ID:** `AUDIT-12`
- **Affected Route(s):** `/projects/:id` (R31), `/projects/:id/studio` (R33)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/projects/DocumentaryFlow.tsx` line 304
  - `apps/frontend/src/video-studio/VideoStudio.tsx` lines 145–160
- **Steps to Reproduce:**
  1. Open an incognito window and navigate directly to `/projects/sample-id/studio`.
- **Observed Behavior:**
  The page displays a blank dark screen with a tiny unstyled button `← Films` and raw text `sign in with Google first`.
- **Expected Behavior:**
  Display a styled card explaining that sign-in is required to view or edit the studio project, with an explicit "Sign In with Google" CTA button.
- **User Impact:**
  Looks like an unhandled application crash rather than an intentional auth requirement.
- **Likely Root Cause:**
  Minimalist early prototype fallback placeholder text.
- **Concrete Recommended Fix:**
  Embed the existing `<LoginPage />` component or a dedicated `<LoginGate>` card inside the unauthenticated project view.

---

#### Finding AUDIT-13: Audio Desk 11-Tab Grid Wrap on Mobile Viewports
- **Finding ID:** `AUDIT-13`
- **Affected Route(s):** `/audio` (R08–R18)
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Audio.tsx` lines 430–460
- **Steps to Reproduce:**
  1. Navigate to `/audio` on a 375px mobile viewport.
- **Observed Behavior:**
  The 11 desk selection tabs ("Text to Speech", "Library", "Voice Change", "Translate", "Clone", "Dialogue", "Dictionary", "Isolate", "Speech to text", "Sound effects", "Suno music") wrap into a massive 6-row grid of buttons, pushing the actual audio workbench far below the screen.
- **Expected Behavior:**
  On mobile, the desk selector should be a horizontally scrollable chip list with smooth momentum scrolling, or a styled `<select>` dropdown.
- **User Impact:**
  Excessive scrolling required on mobile to reach the input forms.
- **Likely Root Cause:**
  Standard desktop `flex-wrap: wrap` without mobile media query constraints.
- **Concrete Recommended Fix:**
  In CSS, set `.audio-nav { display: flex; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }` for viewports under 768px.

---

#### Finding AUDIT-14: Hardcoded "Create Avatar" Navbar CTA Button on Unrelated Pages
- **Finding ID:** `AUDIT-14`
- **Affected Route(s):** `/video-templates`, `/images-templates`, `/pricing`, `/library`, `/mcp`, `/terms`
- **Exact File Path & Line Numbers:**
  - `apps/frontend/src/Nav.tsx` lines 509–542
- **Steps to Reproduce:**
  1. Navigate to `/video-templates` or `/pricing`.
  2. Observe the top-right button in the navigation header.
- **Observed Behavior:**
  The button reads "Create Avatar" and routes to `/avatar`, even when the user is actively browsing videos or pricing.
- **Expected Behavior:**
  The top-right CTA should be consistent and contextually sensible (e.g. "Start Creating" linking to `/projects` or `/avatar` depending on user onboarding state).
- **User Impact:**
  Confusing action button hierarchy when users are engaged in non-avatar workflows.
- **Likely Root Cause:**
  Hardcoded ternary condition in `Nav.tsx`:
  ```tsx
  route.name === "landing" ? "Start Creating" : route.name === "avatar" ? "New documentary" : "Create Avatar"
  ```
- **Concrete Recommended Fix:**
  Standardize the top-right CTA to "Start Creating" (`/projects`) or adapt it according to the active studio workflow.

---

## 4. Page-by-Page Findings & Evaluation

### R01: Landing (`/`)
- **Rendered Visual State:** Clean hero with dynamic video background and floating preview badges ("GENERATE A LOOK", "EFFECTS", "Voices, music, sound").
- **Issues Identified:** Header wraps into 5 rows on mobile (< 700px) (Finding AUDIT-03).
- **Status:** **Warning** (Mobile layout needs responsive drawer).

### R02: Avatar Studio (`/avatar`)
- **Rendered Visual State:** 2-column studio layout (Model settings on left, reference photo dropzone on right). Model cards ("FLUX.2 Klein", "Nano Banana 2", "Qwen Image Edit", "Seedream 4.5") render cleanly.
- **Issues Identified:** Disabled state of "Generate Avatar" button has faint contrast before upload, but functions properly once photo is provided.
- **Status:** **Pass**.

### R03: Images Templates Catalog (`/images-templates`)
- **Rendered Visual State:** Grid of still templates ("Louvre Plaza", etc.) with top `ModelStrip` engine selector.
- **Issues Identified:** Selecting a model engine does not persist when clicking "Generate" on a template (Finding AUDIT-07).
- **Status:** **Warning** (Model state persistence).

### R04: Video Templates Catalog (`/video-templates`)
- **Rendered Visual State:** High-resolution video template gallery ("Luxury Sunglasses UGC", "Apocalyptic Cat Transformation") with worker readiness chip.
- **Issues Identified:** Selecting a video model engine (Seedance, Kling, LTX, Hailuo, Veo) is discarded when opening template studio (Finding AUDIT-07).
- **Status:** **Warning** (Model state persistence).

### R05: Effects Catalog (`/effects`)
- **Rendered Visual State:** Multi-section template grid grouped by effect pack ("Act Natural", "Clones", etc.).
- **Issues Identified:** Top navigation dropdown lists individual packs, but clicking any pack only navigates to `/effects` without scrolling to or filtering that pack (Finding AUDIT-05).
- **Status:** **Warning** (Navigation filtering).

### R06: Documentaries Studio (`/projects`)
- **Rendered Visual State:** Workflow tabs (01 Topic, 02 Script, 03 Shots, 04 Mix). Dark stage card.
- **Issues Identified:**
  1. Hero title `Documentary Studio` is near-white (`#fffdf8`) on light cream background, rendering it almost invisible (Finding AUDIT-02).
  2. Kicker and lede text also suffer severe contrast failure against cream background (Finding AUDIT-02).
  3. Two-column grid has `.film-topic-col-right { order: 1; }` and `.film-topic-col-left { order: 2; }` in CSS, inverting the intended layout and breaking keyboard tab order (Finding AUDIT-04).
- **Status:** **Critical** (Visual contrast & column inversion).

### R07: User Library (`/library`)
- **Rendered Visual State:** User asset grid with lightbox modal integration.
- **Issues Identified:**
  1. Empty state "Create your first avatar" button has invisible black text on black background (Finding AUDIT-01).
  2. Generated audio assets are omitted from this page (Finding AUDIT-09).
  3. Uses blocking synchronous `window.confirm` for deletion (Finding AUDIT-11).
- **Status:** **Critical** (Invisible button text).

### R08–R18: Audio Desks (`/audio?desk=...`)
- **Rendered Visual State:** Functional audio studio with 11 specialized desks (TTS, Voice Library, Voice Change, Dub, Clone, Dialogue, Dictionary, Isolate, Speech-to-Text, SFX, Suno Music).
- **Issues Identified:**
  1. Submit buttons on Voice Change (R10), SFX (R17), and Music (R18) have black text on black background due to `.btn.lime` styling (Finding AUDIT-01).
  2. On mobile viewports, the 11 desk buttons wrap into a 6-row grid, pushing form inputs below the fold (Finding AUDIT-13).
  3. Unauthenticated state shows a pink warning banner without a direct Google sign-in button.
- **Status:** **Warning** (Invisible button text on select desks, mobile wrapping).

### R19: Model Context Protocol (`/mcp`)
- **Rendered Visual State:** 2-column integration desk showing Cursor JSON config, Claude CLI command, and tool capabilities.
- **Issues Identified:** The primary "Copy endpoint URL" button under "Hosted Endpoint" has black text on black background, rendering the label completely invisible (Finding AUDIT-01).
- **Status:** **Critical** (Invisible button text).

### R20: Pricing Plans (`/pricing`)
- **Rendered Visual State:** 3-tier card layout (Free $0, Pro $20, Premium $150) with quota listings.
- **Issues Identified:** All action buttons on the Pro and Premium tier cards ("Sign in to get Pro", "Get Premium", "Current plan") have black text on black background, rendering the checkout and CTA buttons invisible (Finding AUDIT-01).
- **Status:** **Critical** (Invisible CTA buttons).

### R21: Contact Us (`/contact`)
- **Rendered Visual State:** Informational contact policy page with direct support email (`chaudaryfarhann@gmail.com`).
- **Issues Identified:** Hard-gated behind Google OAuth in `Shell.tsx`; unauthenticated visitors are redirected to `/login` when trying to view support information (Finding AUDIT-06).
- **Status:** **High** (Unauthenticated visitors blocked).

### R22: Login Page (`/login`)
- **Rendered Visual State:** Centered card with ambient gradient orbs, brand icon, headline ("Imagine it. Then be in it."), and Google sign-in button.
- **Issues Identified:** None. Renders cleanly across all viewports.
- **Status:** **Pass**.

### R23–R26: Legal Policies (`/terms`, `/refund`, `/delivery`, `/cancellation`)
- **Rendered Visual State:** Standardized legal article containers with clear section headings, high-contrast typography, and valid contact links.
- **Issues Identified:** None. Passes WCAG contrast and responsive tests.
- **Status:** **Pass**.

### R27: Studio Route Alias (`/studio`)
- **Rendered Visual State:** Cleanly redirects to `/projects` in `Shell.tsx` and `Nav.tsx`.
- **Issues Identified:** None.
- **Status:** **Pass**.

### R28–R30: Template Studio Detail Pages (`/images-templates/:id`, `/video-templates/:id`, `/effects/:id`)
- **Rendered Visual State:** Side-by-side comparison and generation studio.
- **Issues Identified:**
  1. Flash of broken media elements when accessed directly while `catalog` is loading (Finding AUDIT-08).
  2. "Create an avatar first" CTA button has invisible black text on black background (Finding AUDIT-01).
- **Status:** **Warning** (FOUC and button styling).

### R31–R33: Documentary Project Steps 2, 3, and 4 (`/projects/:id`, `/cast`, `/studio`)
- **Rendered Visual State:** Director script editor, shot selection gallery, and timeline NLE.
- **Issues Identified:** Unauthenticated visitors see a bare dark box with `sign in with Google first` rather than a styled auth card (Finding AUDIT-12).
- **Status:** **Warning** (Unauthenticated empty state polish).

### R34: 404 Route Fallback (`/*`)
- **Rendered Visual State:** Non-existent routes silently load Avatar Studio (`App.tsx`).
- **Issues Identified:** No 404 Not Found feedback provided to the user (Finding AUDIT-10).
- **Status:** **Medium** (Missing error routing).

---

## 5. Shared Design and Code Anti-Patterns

### 5.1 The `!important` Specificity War between `styles.css` and `product-polish.css`
A major source of regressions across the app is the coexistence of two competing stylesheets loaded sequentially in `main.tsx`:
1. `styles.css` (legacy dark-mode styles, defined with classes like `.btn.lime { background: #150f23; color: #c2ef4e; }`).
2. `product-polish.css` (overrides attempting to enforce global rules with `:is(...)` and `!important`).

When `product-polish.css` applied:
```css
:is(.hf-btn-lime, .btn.lime, .btn-lime, ...) {
  color: #150f23 !important;
}
```
it overwrote the text color without providing the accompanying background color, causing the black-on-black button catastrophe across four major sections of the website.

### 5.2 Mixed Theme Background Fragmentation
The application body background is set to a light cream `#f7f5f0`, while individual studio cards and workspaces (`.compose-stage`, `.film-stage`, `.nle-page`) are dark midnight navy (`#150f23`).  
Because text colors were often styled globally using dark-theme assumptions (`color: #fffdf8` or `color: #cfc8d6`), components that sit outside the dark stage card (such as `.films-hero` in `DocumentaryFlow.tsx`) become unreadable white-on-cream text.

### 5.3 Desktop-First Navigation Overflow
The navigation header contains over 12 clickable dropdowns and links. In CSS, there is no breakpoint where these links are hidden behind a mobile menu button. As a result, mobile devices render all navigation items inline, creating a multi-row header that devours vertical viewport space.

### 5.4 State Disconnect between Catalogs and Workspaces
`ImagesTemplates.tsx` and `VideoTemplates.tsx` implement a `ModelStrip` component allowing users to choose an AI engine (`FLUX.2`, `Qwen`, `Seedream`, `Kling`, `LTX`, `Hailuo`). However, when the user clicks "Generate", the callback only passes `templateId`. The selected model is not passed to the URL query string or route state, causing `TemplateStudio.tsx` to mount with its default engine.

---

## 6. Prioritized Repair Plan

The repair plan is ordered so that shared root causes are fixed first, resolving multiple issues per phase:

### Phase 1: Critical Visual & Contrast Fixes (Immediate Priority)
*Target: Restore button legibility and header contrast across the site.*
1. **Fix Black-on-Black Buttons (`product-polish.css` lines 24–29):**  
   Update the selector to explicitly set `background: var(--lime) !important; color: #150f23 !important; border-color: var(--lime) !important;`. This immediately restores visible text to Pricing checkout buttons, MCP copy buttons, Library empty state CTAs, and Audio desk submit buttons.
2. **Fix Documentary Hero Text Contrast (`documentary.css` lines 161–183):**  
   Change `.films-hero .kicker` to deep purple (`#4b3e70`), `h1` to dark navy (`#150f23`), and `.lede` to muted slate (`#4b4259`).
3. **Restore Documentary Column Order (`product-polish.css` lines 145–148):**  
   Remove `.film-topic-col-right { order: 1; }` and `.film-topic-col-left { order: 2; }` so that Topic / Script drafts naturally on the left and story setup controls sit on the right.

### Phase 2: Responsive Navigation & Mobile Drawer
*Target: Ensure mobile visitors have a standard, responsive navigation experience.*
1. **Add Mobile Hamburger Drawer (`Nav.tsx` & `styles.css`):**  
   Under 768px, collapse `.nav nav` and secondary links into a responsive slide-over drawer triggered by a `☰` hamburger button.
2. **Horizontal Scroll for Audio Desks (`Audio.tsx` & `styles.css`):**  
   On mobile viewports, convert the 11 audio desk tabs from a 6-row wrapping grid into a single horizontally scrollable row with `-webkit-overflow-scrolling: touch;`.
3. **Contextual Primary CTA (`Nav.tsx` lines 509–542):**  
   Standardize the top-right button to "Start Creating" linking to `/projects` or `/avatar`.

### Phase 3: Route Synchronization, State Persistence & Auth Cleanup
*Target: Eliminate state loss, broken initial loads, and accidental auth gates.*
1. **Persist Model Engine Selection (`ImagesTemplates.tsx`, `VideoTemplates.tsx`, `Shell.tsx`, `TemplateStudio.tsx`):**  
   Pass selected `engine` to `onOpen(id, engine)`, encode it as a URL parameter (`/images-templates/:id?engine=qwen-image-edit`), and read it into `TemplateStudio` state.
2. **Add Loading Skeleton to Template Studio (`TemplateStudio.tsx` line 148):**  
   Add `if (!catalog) return <LoadingScreen />;` to eliminate the flash of broken media elements on direct page visits.
3. **Ungate Contact Page (`Shell.tsx` lines 140–146, 255–256):**  
   Remove the forced redirect to `/login` for `/contact` so that prospective clients and unauthenticated visitors can view support details.
4. **Implement 404 Route (`Nav.tsx`, `Shell.tsx`):**  
   Add a `{ name: "not-found" }` route and display an informative 404 error screen when users enter invalid URLs.

### Phase 4: Asset Unification & Accessible Modals
*Target: Polish library experience and replace native browser alerts.*
1. **Unify Audio Generations in Library (`Library.tsx`):**  
   Add an "Audio" tab to the user Library querying generated voiceover, SFX, and Suno music tracks.
2. **Replace `window.confirm` with React Dialog (`Library.tsx`, `auth.ts`):**  
   Implement an accessible confirmation modal for deletion and auth prompts.
3. **Style Unauthenticated Studio Workspace State (`VideoStudio.tsx`, `DocumentaryFlow.tsx`):**  
   Replace raw `sign in with Google first` text with a styled card containing a direct "Sign In with Google" button.

---

## 7. Verification Gaps & Vendor Boundaries

During this audit, frontend rendering, responsive layouts, DOM structures, and local API proxy endpoints were inspected under local development servers (`http://127.0.0.1:5173` and backend `http://localhost:3001`).

The following areas could not be fully exercised end-to-end without active external credentials or paid vendor execution:
1. **Live Cloud GPU Dispatch:**  
   Submitting new render jobs to live RunPod GPU workers (FaceFusion CPU/GPU, LTX-Video H200, Krea, or Qwen) was tested using existing mock/completed job states rather than triggering billable remote GPU runs.
2. **Third-Party Payment Webhook Callbacks:**  
   The payment modal on `/pricing` opens the checkout flow and validates mobile phone format (`pattern="03[0-9]{9}"`), but full real-money payment settlement was not executed against the live gateway.
3. **Live Google OAuth Redirect Roundtrip:**  
   OAuth initiation was validated to point to `/api/auth/login?next=...`, but the roundtrip redirect requires an active Google OAuth consent screen callback to a live production domain.

---

*Report compiled and verified against `marketing-studio-ie` repository.*
