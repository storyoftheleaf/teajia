# Taste · Flavor & aroma

Current direction: a dark, dimensional wheel is the primary interactive surface. Faces use directional enamel lighting, visible underside thickness, and a raised central button. The selected family spreads into its child ring with a hinged tilt; children fold back to their original parent wedge on return. Selecting a family morphs the existing ring into that family's notes. Selecting a note brings its name into the center and raises its segment. The center returns to all families. Neighbor controls move between families without returning home. Family navigation does not save an observation. Following Adrian’s 22 October instruction, tapping a specific note now selects it immediately; a second tap removes it. Broad-family recording remains an explicit action. Search and the direct Words view remain available.

Animation uses interpolated radial geometry, with interruptible transitions. Reduced-motion preferences skip the morph. No forced spinning, drag gestures, required intensity, quality inference, or completion scoring. Names remain stable when their observation is recorded.

## Content authority

Aligned to the shared Taste.md revision: **21 October 2026 — all four sections reviewed for beginner clarity; Oily retained as a standard texture.** The shared source was read and left unchanged. The exported vocabulary.json records the flavor vocabulary and expression questions used here.

- Eleven families. Earthy is the broad Earth & fungi observation; Mineral-like is the broad Stone & metal observation.
- Roasted, Charcoal, Cocoa, Smoke, and Burnt remain distinct standard notes, with brief explanations. Toasted rice remains standard.
- Toasted, Dark chocolate, Forest floor, and Slate remain available as personal wording. Search surfaces related standard terms while offering the exact original phrase as a custom observation; it never silently substitutes it.
- Expression asks three optional single-choice questions: Distinct / Hard to distinguish; Several layers / One main character; Work together / Clash. No choice infers quality.
- Sweet in Basic tastes differs from sweet/creamy aroma. Returning sweetness / Hui gan is separate; aftertaste uses the existing observation and timing.
- One assessment per section, independently clearable. Untouched is distinct from Undecided.

## Scope

Only Flavor & aroma is implemented. Feel, Energy, and Storage are scope placeholders preserving flavor input when switching tabs. Oily remains a standard texture in the authoritative specification; no Feel vocabulary is implemented or changed by this screen. Body, texture, coating, drying, salivation, and throat comfort remain separate questions for future Feel work. No production code or shared content source was changed.

Saved observations keep their original wording, including entries from an earlier vocabulary revision. They are not silently translated. The current standard picker uses the revised vocabulary. Saving is local to the browser, with no account or sync. Tea style is optional. All fourteen editorial starting-point sets in Taste.md section 9 are available, plus Unknown style and unspecified Oolong. Starting words navigate to a preview; they never record, preselect, or restrict an observation. The complete wheel keeps its spatial order.

## Verified and unverified

Browser checks cover family-to-note animation, preview versus recording, the center returning home, repeated navigation, horizontal fit at 320/390/768px, revised standard vocabulary, mutually exclusive expression pairs, preserving custom wording, and reduced motion. Existing observation details and local saving remain in the prototype.

Desktop browser checks do not establish frame rate on real phones or prove that the design is enjoyable. Try Floral → Orchid → center, switch to another family, then record a word. The animation should make each relationship clear without requiring you to wait before the next action.

The earlier design-findings.md is a research record. Its recommendation of tiles predates Adrian's explicit direction to make the wheel the advanced primary interaction.

## Chinese tea wording and aroma location

The standard vocabulary remains aligned with Taste.md. Each family now also offers a few explicitly personal comparisons, such as Gardenia, Pomelo peel, Dried jujube, Cacao nib, Agarwood, or Porcini. These are expressive suggestions, not validated profiles or new standard terms. Their brief explanations describe the comparison, not a claim about what a particular tea contains. Search finds them and their exact wording is preserved.

The optional Aroma / Taste / Both controls now sit beside the individual observation preview and are also editable after recording. Unknown stays unknown. For beginners, the explanatory help distinguishes smell from character in the sip. Basic tastes remain a separate group. Flavor combines several sensory contributions, so the design recommendation is one shared vocabulary with per-observation location, rather than two duplicated wheels. See [NIDCD's taste/smell explanation](https://www.nidcd.nih.gov/health/statistics/what-numbers-mean-epidemiological-perspective-taste-smell).

Dark mode is now the default. No theme choice is required. No change to Teajia, no deployment, and no edits to the shared content specification. Real phone frame rate and user enjoyment remain unverified; local browser checks are the current evidence.

## Refined finish and automatic reference context

The current visual direction uses shallow stone-like relief, a low-saturation jade/bronze/umber palette, warm ivory serif labels, fine edges, and softer shadows. The dimensional opening/folding interaction remains. Compact mode reduces the wheel from 372px to 304px at the checked 390px viewport; all families and note interactions remain available.

The standalone now exposes a demo tea-context selector rather than asking someone to choose a flavor template. The selected demo's recorded type automatically determines its reference words. In an integrated application this input would come from the tea record. There is no production integration in this standalone. Draft observations are kept separately for each demo tea so switching contexts does not misattribute a tasting. Save persists the current context and the stored drafts locally.

Wenshan Paochong, Oriental Beauty, and roasted Dongding have linked expert references adapted from Su et al. 2021, Appendix A and section 3.3. Other starting-point sets remain explicitly editorial; the app does not claim the study validates every Chinese tea category. Selecting the reference heading opens its provenance. References never auto-record observations, intensity, or assessment. Unknown type stays neutral.

## Selected animation: Nested

Adrian selected Nested from the five-direction comparison. It is now the tasting prototype’s animation: the family ring contracts into a quiet inner band while a ring of specific words expands outside it. The center retracts the outer ring and restores the full family wheel. The previous hinge/fold direction is superseded. Refined dark styling, Compact mode, tea-type references, and observation semantics remain in place.

## Smaller center and family icons

The center is now 30% of the wheel diameter, down from 37%. The nested family band is widened and contains eleven consistent fine-line icons. These remain native, named controls and let someone navigate directly between families without recording observations. The center still restores all family names. Icons and labels are checked in normal and Compact modes; the Words route remains available for direct named selection.

## Selection feedback · 22 October 2026

Active family navigation has a persistent bronze tint and outline. Recorded notes have a distinct persistent jade tint. These meanings do not depend on mouse focus. Family icons show their full name on hover, focus, or press, with a native accessible name and a shared tooltip. A specific wheel note or personal comparison selects on the first tap and toggles off on the next. Labels remain unchanged. Optional Details are separate; no confirmation click is required to select a note. Family navigation itself still does not record a broad family. Selection tints survive navigation, undo, and save/reload. This supersedes earlier preview-then-record descriptions in the historical notes.

## Ten refinements · 22 October 2026

1. Selective, upright label angles are fitted to each sector. Top and bottom words stay horizontal; most other angles remain gentle. A few long words use a steeper angle when space requires it.
2. Each word receives its own measured width and line breaks rather than one fixed text box.
3. The typography selector compares Lora (Literary), Cormorant Garamond Medium (Elegant), and Plus Jakarta Sans (Modern). Latin font files are embedded for offline rendering.
4. Each treatment uses one chosen display/label family and Plus Jakarta Sans for controls, with at most two font families visible together.
5. Labels use medium weight, 12px or larger for Lora/Jakarta and 15px or larger for Cormorant, at the tested sizes.
6. Placement includes optical radial and angular adjustments, checked against the actual segment boundaries.
7. Hover/focus/press family names occupy a fixed rail above the wheel, leaving notes unobscured.
8. Small dots under family icons indicate that the family contains selected observations. They communicate presence, not a score or completion goal.
9. The redundant previous/next family row is removed; the icon ring provides direct navigation.
10. Note selection applies its tint immediately, with a short, reduced-motion-aware settling response. The longer Nested motion remains for moving between families.

Verified 744 standard-note/font/width fitting combinations with no geometric fallback, along with font preference persistence, single-tap selection, tint preservation, undo/save, compact layouts at 320/390/768px, and reduced motion. Long center names fit whole words instead of breaking a final character onto its own line. Browser checks remain distinct from usability testing on real phones.


### Symmetric wheel typography correction — 22 October 2026

Replaced independent label-angle fitting with one geometric rule: every label is tangent to its slice arc and centered on its bisector. Lower-half text flips upright. Mirrored slices receive mirrored angles. Family labels share one radius, note labels share another; fitting can change line breaks but cannot rotate or shift a label independently. Compact overview labels use a uniform size adjustment across all families. Verified all 132 family and 744 note/font/width combinations; visually inspected overview and Floral wheels. Supersedes the earlier selective-angle typography decision.

### Radial overview and curved detail labels — 22 October 2026

Supersedes the previous tangent-only correction. Main family labels now run lengthwise on the slice bisector, centered at radius 125. Left-side labels flip 180 degrees for readability. Note labels follow actual circular SVG text paths at radius 145, centered at the angular midpoint. Lower-half paths reverse to keep letters upright; this intentionally means glyph bottoms cannot face the center everywhere. Each note ring uses one shared font size, calculated from its longest descriptor and available arc length. No label has a personal angle or angular position adjustment. Verified 132 family fitting combinations and 99 complete note rings across three fonts and three viewport widths; inspected overview, Floral, and Fresh fruit. Real click handlers still select and remove notes in one click.


### Optical centering and restrained ring sizing — 22 October 2026

Note-label radii now use the annular sector area centroid with a small shared optical adjustment and an inner-edge clearance. Broad slices therefore place their text farther inward than narrow slices. Canvas ink metrics align visible cap-height around the path instead of relying on the SVG central baseline. All labels in a ring share exactly one radius and size. Rings with 5–6 notes gain 6%; rings with up to 4 notes gain 12%; crowded rings retain the base size. The longest descriptor caps the whole ring equally if needed. Fixed a redraw path that could overwrite cached family-label positions. Verified 99 complete ring/font/viewport combinations for arc fit, exact size and radius consistency, and single-click selection/removal. Inspected Stone & metal in normal and compact mode, including Cormorant.


### All-family visual centering pass — 22 October 2026

Reviewed all 11 note families in full and actual compact layouts. The unblended sector centroid had overcorrected broad Stone & metal and Earth & fungi slices toward the hub. Label radius now blends the ring midpoint with sector area balance and stops at radius 141 (inner ring radius 109); all words in a ring retain identical radius and size. Kept mirrored arcs and the restrained size steps. Verified 198 combinations (11 families × 3 fonts × 3 viewports × 2 sizes), including visible-character bounding-box clearance from both ring edges, exact shared ring sizing and arc fit. Final visual contact sheet: all-family-centering.png.


### Navigation return fix and quieter center — 22 October 2026

Reproduced the return glitch: inner-family animation updates label coordinates, then the layout-cache early return skips restoring overview coordinates. Family label positions are now reapplied before the cached typography shortcut. Verified identical overview coordinates before and after returning.

The center uses smaller restrained type, a quiet charcoal background, neutral border, and a back-arrow hint. Overview reads Explore / Choose a family. A previewed note center steps back to its family; the family center steps back to all families. Both use destination-specific accessible labels. Note selection remains saved through navigation. Active icons and selected observations now use charcoal / soft gray, replacing gold; chips and other selected controls use the same neutral treatment.

Verification: 66 complete return sequences across all 11 families, three fonts, and both sizes, plus normal animated and interrupted return paths, neutral selection color, persisted observation, and browser error checks. Inspected overview, family, and selected-note states.

### Calm tea-paced motion with immediate input — 22 October 2026

Family transitions now last 1,050 ms with a cosine ease-in/out instead of a front-loaded 580 ms cubic ease-out. New note surfaces begin close to their final shape instead of bursting from a thin outer iris. Labels, icons and clipped hit targets switch to final positions synchronously, while only the decorative surfaces interpolate. Exiting words stop accepting input immediately. Fast navigation interrupts from the current visual state without queuing clicks. Selecting a note updates its state without cancelling or snapping the ongoing family transition. Removed selection lift and replaced center text's slide with a subtle opacity change. Reduced motion resolves the layout synchronously.

Verified real pointer selection during the opening transition, continuous geometry after selection, six rapid interrupted navigation sequences, reduced motion, and repeated return positioning. Inspected early, middle and settled states. Broader regression verifies all 66 family/font/size return sequences and neutral selection persistence.

### Inner selection tracks and a quiet dissolve — 22 October 2026

Replaced the overlapping iris geometry with immediate destination layout and a subtle 700 ms surface-only opacity settle (82–100%). Words and input remain immediate; fast navigation cancels the previous surface fade rather than queuing motion. Reduced motion skips it.

Selected notes now show a roughly 10-unit pale gray/sage arc just inside their segment's inner edge, with a two-unit inset. Families containing observations show the same segmented inner track in the icon band and overview; the dots are removed. Observation selection no longer recolors the whole slice. Current family navigation retains its separate neutral active treatment. Tracks persist through back navigation and disappear when the last relevant observation is removed.

Verified real selection/removal, family aggregation, no dot/full-slice tint, fast navigation, compact rendering, reduced motion, and browser errors. Inspected note, overview, and compact multi-family track states; repeated all 66 family/font/size return sequences.

### Overlapping ring depth, restored motion, dark selection — 22 October 2026

Corrects the prior dissolve-only approach. Restored 950 ms shallow radial motion with cosine easing; words and hit areas still update immediately. Retargeting cancels the prior frame loop, and selecting a note leaves the ongoing surface movement intact.

Rings now overlap physically in the render stack: note surfaces (inner radius 102), a soft cast shadow, family surfaces (56–110), then the HTML center disk (radius 60). The center covers the inner family edge; the family layer covers the note ring's inner edge. Removed hard circular strokes and retained only faint radial seams and keyboard focus indication. Center elevation uses a soft shadow instead of an outlined rim.

Selection remains an inner-edge track but is now a dark radial gradient (#101410, peak alpha .68), feathered out across about 20 SVG units instead of a bright solid band. Selection removal fades over 350 ms. No dots or full-segment observation tint. Both track contrast and ring underlap were inspected at full and compact sizes.

Verified restored intermediate geometry, immediate real pointer selection, layer order and overlaps, dark-to-transparent gradient stops, bounded gradient definitions, rapid interruptions, reduced motion, all 66 family/font/size return sequences, and 198 label-clearance combinations.

### Sliding nested rings, broad espresso selection, concise hub — 22 October 2026

Surface animation now uses current geometry as its starting point: new outer notes begin tucked under the family layer (outer radius 108) and expand to 181; the family layer simultaneously retracts to 110. Back reverses the geometry and retains outgoing notes until they tuck under the family layer, then removes them. Duration 1,250 ms, cosine ease-in/out, with no opacity flash or queued input. Words and hit targets use the destination immediately. Rapid retargeting starts from current surface positions; reduced motion resolves synchronously.

Expanded selection from a small inner band to a broad espresso radial overlay across the entire slice, with a substantial opaque inner/middle area and feathered outer edge. Peak alpha .94, middle .82, outer edge transparent, color #21130d. Observed family icons shift to warm brown, and the center gains an espresso surface when the current family contains selections.

Center now shows only a short family title (Floral, Fruit, Dried fruit, Sweet, Nuts, Roast, Vegetal, Spice, Wood, Earth, Mineral) plus a single back-arrow icon. Removed tiny context and instruction strings. Full section names remain in the family-name rail and accessible names. One center tap returns directly to the overview and triggers the tuck animation; note preview no longer introduces a visually redundant intermediate back step.

Verified real pointer selection while a ring is concealed, intermediate expansion and retraction, final cleanup, rapid interrupts, espresso gradient and icon colors, reduced motion, and all 66 family/font/size center layouts and return paths. Inspected normal selected, overview, and compact states.


### Five live motion examples and full-slice neutral selection — 22 October 2026

Rebuilt wheel-directions.html as an interactive comparison using the actual prototype wheel through an isolated demo iframe. Five surface engines: Telescope (radial extension), Aperture (inward reveal), Fan (angular unfolding), Float (scale and opacity), Turn (small rotation and opacity). Each opens and reverses at the same 1.2-second pace. Destination words and taps remain immediate. Selecting a mode replays it; Open Fruit, Back, and Reset are available, as is direct wheel interaction. The demonstration does not save over tasting observations. Main prototype keeps Telescope pending a user choice.

Selection is now a neutral black radial overlay covering exactly the same path as its segment. Removed both angular insets and radial margins. Gradient alpha remains above zero at every edge (.76 inner, .66 inner-middle, .48 outer-middle, .56 outer), darkening the underlying family hue without brown coloration or an untouched rim. Center and selected icons return to neutral tones. Display family renamed Sweet & creamy; existing saved broad notes/group labels are normalized when rendered.

Verified all five open/reverse examples, immediate note selection during motion, outgoing cleanup, desktop and 320/390/768 layouts, matching selection/background paths, neutral stops and nonzero edge coverage. Visually inspected comparison desktop/mobile and selected Fruit.

### Telescope chosen; full retraction and no selection rim — 22 October 2026

User selected Telescope. It remains the main prototype's default. New rings begin at radii 12–54, fully concealed by the center (radius 60). Outgoing rings now retract to the same radii instead of stopping at 102–108 beneath the icon band. Telescope surfaces stay opaque while sliding, so fading does not truncate the apparent travel. Words and hit areas remain immediate, and retargeting continues from current geometry.

Removed the selected slice's faint seam and offset colored base edge; active family navigation also uses its original enamel rather than a separate slate fill. Selection remains the existing whole-slice neutral darkening. Its path and gradient now follow the animated surface exactly, with one reusable gradient per node, so a full-size overlay cannot appear ahead of the emerging ring.

Verified concealed start and end positions below radius 60, intermediate expansion, exact selection/surface path matching, absence of selected outlines and base/seam ledges, rapid interrupts, reduced motion, and 66 family/font/size center and return checks. Inspected full and compact selected Fruit.

### Ten integrated refinements — 22 October 2026

1. Telescope opacity now follows the ring's emergence past its moving parent edge; the visible reveal spans roughly 24 SVG units. Outgoing surfaces fade while retracting. Words/hit targets remain immediate.
2. Full physical retraction beneath the hub is preserved, while upper layers conceal most travel. The final visible reveal is shallow and softened.
3. Telescope opens over 1,050 ms and returns over 800 ms, with a damped response instead of a single mechanical interpolation.
4. Per-node radial velocity and opacity velocity persist across retargets. New clicks do not reset position or brightness or queue transitions. Outgoing inputs disable immediately.
5. Family shadow radius follows the moving outer edge (+15 units), and shadow strength tracks its exposed elevation instead of switching abruptly.
6. Whole-slice neutral darkening strength is derived from the family's base luminance. All edges remain covered; no selection rim or additional hue is introduced.
7. The center heading DOM persists while selecting notes, with no selection-triggered fade or slide. It changes only on family navigation.
8. Optional assessment moves to Assess; typography and view/compact controls move to the settings disclosure. Tea reference suggestions stay available in a collapsed disclosure. On a 390×844 screen, the wheel moves from y≈454 to y≈298.
9. The live Selected strip and Undo now sit directly below the wheel. Selected observations are visible on the same 844px screen; the strip is reattached safely when switching views, categories, search, or teas.
10. Details now contains location choices, personal comparisons, broad recording, and access to observation editing. Its disclosure state survives selection updates. Existing note editing, save, independent tea drafts, and optional assessment semantics remain intact. Save acknowledgment stays visible on the button.

Verification: real pointer selection during motion; measured partial opacity and moving shadow; stable center heading; velocity/opacity/position continuity across retargets; six rapid interruption paths; 66 family/font/size return layouts; reduced motion; 320/390/768px overflow checks; full and compact visual review; progressive Details, observation editing, assessment, settings, tea references, save/reload, and per-tea draft restoration. Visually inspected opening and return sequences. Main mobile layout fits within 844px with selected Apricot and collapsed details.

### Center-back becomes a fade — 22 October 2026

Opening a family retains the damped Telescope. Center-back now uses a 650 ms stationary crossfade: snapshot the current surface stack, immediately lay out the clickable family overview, fade the overview in and the outgoing surface snapshot out without radial movement. Clone IDs and gradient references are isolated. A subsequent click cancels/removes the outgoing snapshot and retargets opening immediately. Reduced motion switches directly without a snapshot.

Verified the overview geometry stays fixed at its destination throughout return, intermediate opacity rises between 0 and 1, a family and note can be selected mid-fade, outgoing snapshots/note nodes clean up, and reduced motion remains instant. Inspected the intermediate fade visually.

### Persistent current-location highlight — 22 October 2026

Current family now has a muted sage highlight and brighter ivory icon, with no border. Current location takes precedence over the family's saved-note shading while it is open; the family's full observation shading returns on navigation away. Outer selected notes remain dark. Section tabs and observation categories share the same restrained highlight language. Exactly one current family is marked aria-current, and returning to the overview clears it. Verified all 11 families, selection coexistence, category/section navigation, reduced motion and visual rendering.

### Active family uses its own lighter hue — 22 October 2026

Replaced the shared sage location fill with a dedicated version of each family's original enamel gradient, lightened 12% toward white. Active icons remain ivory. While a family is open, its location highlight takes precedence over its observation shade; selected outer flavors remain fully dark, and the family's saved-observation shading returns when navigating away. No borders added. Verified all 11 gradients derive from their original colors, selected-note shading persists, and navigation restores observed-family shading. Inspected selected Fruit.

### Stronger original-hue location crossfade — 22 October 2026

Active family enamel is now lightened 19% toward white (previously 12%). A separate full-segment location overlay fades over the unchanged base in 450 ms, allowing old/new family highlights to crossfade smoothly and reverse naturally during fast switching. Selected outer flavor gradients remain dark; current family precedence remains intact. Reduced motion resolves the overlay immediately. Verified intermediate old/new opacities, all 11 derived colors, selection during the fade, and no browser errors. Inspected selected Spice.

### Full/compact highlight stress test and five color studies — 22 October 2026

Repeated eight fast family switches in each size, interrupted center-return fades with a new family choice, checked opacity immediately before/after retargeting, and waited for settling. No brightness jump over the test tolerance, stale active overlay, leftover return snapshot, or selected-note lightening occurred. The original prototype's palette remains the default.

New color-directions.html compares five complete palettes on the actual wheel and full tasting interface:
- Obsidian & silk: near-monochrome charcoal/ivory, primarily shadow separation.
- Tea garden: related olive, leaf and moss hues for families.
- Warm limestone: warm taupe and linen with softer tonal layering.
- Slate & pearl: cool mineral tones and slightly clearer radial seams.
- Mulberry & ash: restrained warm plum/ash tones with material-like variation.

Each study styles the surrounding UI, hub, family surfaces, icons, active states, typography colors, controls, and layer depth. It retains the original-hue active highlight and neutral dark edge-to-edge flavor selection. All five support live family switching, overview, compact mode, and Full tasting view. Preview Apricot is intentionally seeded only inside the isolated color study; preview saving is hidden and no tasting draft is overwritten. Main prototype can preview a study via the palette URL parameter without changing the default.

Verified 10 palette/size states, all 11 base and active family colors per palette, muted-text contrast, responsive 320/390/768 layouts, selected path coverage, active marker count, and full-screen previews for every palette. Minimum normal label contrast ranges 6.85–7.33:1; minimum active-icon contrast 4.08–4.28:1. Inspected the 10-wheel contact sheet and all five full tasting screens. Desktop/mobile preview controls and names match the displayed palette after navigation.

### Three harmonious family-color directions and ring-join repair — 22 October 2026

Replaced the five near-monochrome comparison choices with the three requested multicolor directions: Natural Pigments, Chinese Ceramics, and Antique Textiles. Each gives all eleven families distinct, restrained hues at controlled lightness. Comparison starts at Overview so the family relationships are visible; Family view demonstrates the lighter original-hue current location beside selected notes. Natural Pigments and Antique Textiles use deep neutral selection shading. Chinese Ceramics deliberately tests pale porcelain selection with dark lettering/icons. All support full/compact and complete tasting-screen views. Existing comparison URLs retain their previous palette definitions; the main prototype's default palette is unchanged until a direction is chosen.

Reproduced the screenshot defect: angular insets left a .016-radian gap between neighboring wedges, while a translated (0,3) base exposed uneven dark ledges. At the bottom inner-family join, the gap also let pointer input hit the underlying note ring (note-1-4). Removed the insets and offset bases/seams. Adjacent geometry now shares exact boundaries; a subpixel paint overlap covers antialias hairlines. Material, active highlight and selected overlay use the same footprint. Depth remains a continuous ring-level shadow, rather than an offset on every slice. The same test point now hits family-5.

Verification: 66 inner-ring boundary hit/geometry checks across all three palettes and both sizes; 9 overview/family/compact visual states; 6 palette/size rapid-switch and interrupted-return stress paths; no stale highlights or snapshots; retained selection states; responsive 320/390/768 layouts; full context inspection for all three directions. Normal label contrast minima: 5.06 (Pigments), 5.14 (Ceramics), 4.86 (Textiles); active icon minima: 3.28, 3.33, 3.14 respectively. Porcelain selected-label contrast also passes. Main compact layout, optional details, assessment, view settings, save/reload and tea drafts pass regression checks.

### Richer, darker family palettes with shared hairlines — 22 October 2026

Deepened the three family-color studies by reducing HLS lightness to 78% and saturation to 72% of their prior values, keeping the hue relationships. Backgrounds and hubs move toward deeper ink, patinated stone and walnut. Accents stay muted. Chinese Ceramics now also uses dark selected surfaces rather than pale porcelain, matching the requested rich/dark tone.

Added consistent .7px radial divider lines with non-scaling stroke, in subdued warm-metal, pewter or bronze tones by palette. They remain present for both normal and selected slices, and render above the highlight/selection overlays. Added a single .55px continuous family-ring edge whose radius follows the moving ring; no shifted segment bases or geometric gaps return. Current-family highlights still use a lighter version of their own hue and crossfade smoothly.

Verified nine overview/family/compact states, 66 boundary hit/geometry checks, all three full tasting-screen previews, responsive layouts and six rapid-switch/return stress checks. Normal label contrast minima are now 6.81, 7.06 and 6.71:1; active-icon minima 4.00, 4.18 and 3.92:1. Selection states, cleanup and gap-free joins remain intact.

### Natural Pigments interaction finish — 22 October 2026

Natural Pigments is now the main wheel's default. Selected flavors use a restrained tonal shade (26–32% neutral coverage), retaining the underlying family pigment rather than the previous near-black vignette. The complete segment remains shaded edge to edge; radial hairlines stay intact. Hover softly brightens the pigment; the current family remains a lighter version of its own hue, distinct from recorded selections.

Fixed the center hover flash at its source: the theme hover rule replaced the radial gradient with a solid background. Hover now preserves the same gradient; only the back arrow gains opacity, without changing geometry or text.

Returning to the overview uses a 760ms staged fade. Backgrounds settle by roughly 470ms; labels begin near 502ms and finish at 760ms. Hit targets remain immediately available. Interrupting the transition removes its snapshot and label delay; reduced motion resolves immediately.

Verified selected shading values, repeated center hover cycles, staged background/label opacity, rapid family switching, interrupted returns, and reduced motion in compact and full sizes. Inspected screenshots of both layouts. Existing responsive controls, details, assessment, save and per-tea drafts pass focused regression checks. No browser errors. The static design detector reports legacy stylesheet/font warnings; rendered screenshots and interaction checks were used to assess this scoped change.

### Inset selected-flavor outlines — 22 October 2026

Natural Pigments selected notes now have a .9px inset hairline derived from their own family pigment, with only 4–10% background shading. The outline is offset equally from the circular and radial edges and does not change segment geometry or hit areas. It fades with selection and remains a constant screen thickness in compact and full layouts. Hover retains its soft pigment lift; active-family location retains the stronger lighter pigment and icon treatment. Family observations continue to be indicated through the family icon without adding another outline to the navigation ring.

Verified actual pointer selection/deselection, selection restoration after changing family, inset outline geometry, both sizes, repeated center hover, background-before-label return timing, rapid switches and interrupted fades. Inspected full and compact screenshots; no browser errors.
