# Flavor & aroma: interaction findings

> Update: Adrian subsequently chose an animated wheel as the primary interaction. See interaction-brief.md for the current design and revised vocabulary alignment. The comparisons below remain research observations; the tiles recommendation is historical.

Reviewed 21 October 2026. This is a design comparison, not a claim that Taste or the reference products have passed comparative usability testing.

## What I recommend

Start with compact colored family tiles, retain a stationary wheel as an alternate discovery view, and keep direct word search available in both. A family opens a small set of specific words plus an explicit broad-family record action. Navigation must never silently record an observation.

The circle earns its place only if it helps someone find words or enjoy exploring them. It is not the underlying data model and should not be a gate to recording a note. Eleven family names are already a lot to fit around a small phone circle. A tile browser can show exactly the same families with larger labels and a shorter screen. Neither is established as the winner until people try both.

## Reference comparison

| Example | What the source shows | Useful idea | My critical assessment for Taste |
|---|---|---|---|
| [tea.degree sensory wheel](https://tea.degree/instruments/wheel) | Sixteen families; tapping a wedge reveals four descriptors; a note builds below. Its initial mobile screen was visually inspected at 390px. | A restrained two-step entry route, color by family, selected-note summary. | In the inspected phone rendering, introductory copy consumes much of the first screen and wheel labels are tiny. A family-led interface is useful; this rendering is not evidence that a wheel is easy. Four descriptors per family may also feel restrictive. Taste must allow a family observation and custom words. |
| [Café Imports Coffee Rose](https://www.cafeimports.com/europe/blog/sensory-analysis/coffeerose/getting-started/) | Choose a descriptor, press Plus, choose intensity; history permits reviewing/removing entries. Scores update from selections. | Per-observation intensity, revising a note, broad-to-specific vocabulary. | Extra confirmation and intensity steps raise the cost of every note. Its scoring model conflicts with Taste: a selected descriptor must not imply quality. Do not import its mandatory intensity or category-completion rules. The live account-gated cupping flow was not tested. |
| [Coffee Rose technical paper, 2022](https://cdn.cafeimports.com/images/Fretheim_I_2022_RichContentCATAforSpecialtyCupping.pdf) | The documented design rotates and expands an active category and includes up to four descriptor tiers. It requires intensity to endorse an entry. | Expand the currently useful vocabulary instead of displaying everything at once. | Moving target positions can require reorientation. That is a design concern, not a measured outcome here. Taste should keep spatial organization fixed, use fewer levels, and accept sparse notes. The 2022 paper is historical documentation, not proof of the current UI. |
| [Not Bad Coffee](https://notbadcoffee.com/flavor-wheel-en/) | Clicking the wheel opens a flavor card with definitions, reference materials, and preparation details. | A word can teach a useful distinction at the moment someone needs it. | A vocabulary reference and a quick tasting recorder have different jobs. Do not put reference-sample preparation or calibration information in every recording step. The wheel itself did not render in the browser capture used here, so its touch behavior was not assessed. |
| [MyTeaPal](https://www.myteapal.com/app) | The official app description offers 100+ flavor tags and custom tags. | Standard vocabulary can coexist with personal language. | Tag quantity alone tells us little about findability. Custom wording must be visible and easy, rather than a buried escape hatch. The native app was not installed or tested. |
| [D. Prior interactive wheel](https://dianaprior.com/guides/coffee-flavour-wheel) | Tap a family or descriptor for a description and palate-training tip; explicitly says specificity is not required. | Permission to stay broad and short contextual explanations. | Training tips should be optional. A long catalog and an attractive wheel do not establish fast mobile entry. Reviewed its published page, not a timed interaction study. |
| [Steel Oak shop-by-flavor](https://steeloakcoffee.com/pages/coffee-flavor-wheel) | Broad-to-specific browsing with a search shortcut to a note, used to match products. | Let people jump directly to a known word. | Product filtering is not self-description. Its exclusion of some categories from recommendations must not be copied into Taste's observations. |

## What the research actually supports

[Ares & Jaeger, 2013](https://www.sciencedirect.com/science/article/pii/S0950329312001838) studied three consumer sensory-description tasks with 335 participants. Attribute order affected responses; randomly arranged attributes also produced fewer mentions than grouped attributes. The study supports caution about presentation bias. It does **not** establish that tiles beat wheels, or that tea styles should never prioritize words. For Taste I recommend a stable map, grouped words, no preselection, and no reordering after an assessment. Any style-prioritized starting words should be visibly described as suggestions and tested for leading people.

[W3C's enhanced target-size guidance](https://www.w3.org/WAI/WCAG21/Understanding/target-size) uses 44 × 44 CSS pixels; [the WCAG 2.2 AA minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) is 24 × 24 with exceptions. These support generous touch areas, not a claim of full accessibility conformance. Taste's wheel should use the actual segment as its target, not just a small label.

## Where the enjoyment should come from

These are design hypotheses to test:

- Recognition: “Floral is enough” gives someone a useful stopping point immediately.
- Discovery: a family reveals six or eight approachable words, not a wall of technical language.
- Ownership: their selected words form a small personal record; unfamiliar words can be replaced with their own.
- Gentle feedback: a color change and a concise confirmation make a tap feel responsive without delaying the next tap.
- Confidence: undo is visible, broad choices are valid, and nothing demands a complete profile.

Avoid rewarding the number of descriptors, forced spinning, quizzes during recording, completion rings, automatic quality judgments, or AI guesses presented as the person's experience. Those mechanisms could change what gets recorded or make a short session feel insufficient.

## Prototype and acceptance tasks

[Open the standalone prototype](flavor-aroma.html). Tiles, Wheel, and Words are alternative routes to the same vocabulary; they are not three simultaneous lists. Only Flavor & aroma is implemented. The other tabs demonstrate switching and preservation, with explicit scope messages. Tea style is optional context; prioritization has not been implemented. Saving uses this browser's local storage, with no account or sync.

Try both Tiles and Wheel with the same tasks:

1. Record broad Floral and stop without giving an assessment.
2. Find and record Orchid; confirm that opening Floral did not record it.
3. Record pronounced Orchid in Aroma and subtle Fresh fruit in Taste.
4. Record welcome Bitter and returning sweetness; keep intensity separate from appraisal.
5. Undo a mistake, enter an unfamiliar phrase, switch section tabs, save, and reload.

Compare wrong taps, backtracking, ability to explain what was saved, readability, and time to first useful observation. Ask separately whether the experience was inviting and whether the person wanted to explore another family. Shorter time alone does not establish enjoyment. Research sources did not provide a controlled comparison proving the best interface for this task.

## Tools and limits

Discovery used web search and Exa through Agent Reach. Official product pages and the Coffee Rose paper were read directly. Browser rendering checked the tea.degree phone screen; a separate isolated browser checked the local prototype. Firecrawl was attempted but its service timed out; it did not contribute evidence. Agent Reach's update check could not resolve its update server. No native app installations, paid subscriptions, or account creation were used.
