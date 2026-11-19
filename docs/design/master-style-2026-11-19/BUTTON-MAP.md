# Button map: every measured look → variant

Measured on main at 1440px (60 distinct looks, public pages and the manage rooms, local sandbox data), 2026-11-19. Numbering matches buttons-before-1440.png. Variant assignment is by measured shape (fill, border, size, case) and was read through once by eye.

Variants (src/styles/tokens.css, section 6): **primary, secondary, quiet, icon, tab, chip, field**, sizes `btn-sm` / `btn-lg`, tone `btn-danger`.

- **Done**: the element already wears the variant class.
- **Mapped**: the variant it becomes; not moved in this PR. The guard holds the count of hand-built buttons so it cannot grow.
- **Exempt**: not a button (a table row, a card link, a tile) measured because it is clickable.

Tally: quiet · Mapped 18; icon · Mapped 12; (not a button: row, card or tile link) · Exempt 8; tab · Mapped 8; secondary · Mapped 5; chip · Mapped 4; primary · Done 2; primary · Mapped 2; field · Mapped 1.

| # | Size | Type | Fill | Border | Corner | Example | Variant | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 106×824 | Lora 16px/400 | rgb(50, 46, 41) | yes | 12px | “3 of 7 steps done Your i” ×23 | (not a button: row, card or tile link) | Exempt |
| 2 | 39×111 | Plus Jakarta Sans 12px/400 caps | none | no | 0px | “CUSTOMERS” ×17 | tab | Mapped |
| 3 | 36×1200 | Plus Jakarta Sans 16px/400 | none | yes | 0px | “Asahi あさひ Japan Kyoto (U” ×16 | (not a button: row, card or tile link) | Exempt |
| 4 | 24×24 | Lora 14px/400 | none | yes | 4px | “−” ×12 | icon | Mapped |
| 5 | 28×107 | Plus Jakarta Sans 11px/400 caps | none | no | 6px | “CUSTOMERS 1” ×11 | tab | Mapped |
| 6 | 32×34 | Plus Jakarta Sans 12px/400 | rgb(34, 32, 28) | yes | 4px | “Refresh purchases” ×10 | icon | Mapped |
| 7 | 28×96 | Plus Jakarta Sans 12px/400 | none | no | 0px | “Identify items” ×10 | quiet | Mapped |
| 8 | 99×1288 | Lora 16px/400 | none | no | 0px | “— Save Sandbox Photo Pri” ×9 | (not a button: row, card or tile link) | Exempt |
| 9 | 17×87 | Plus Jakarta Sans 11px/400 | none | no | 0px | “Show only these” ×9 | quiet | Mapped |
| 10 | 28×66 | Lora 13px/400 | none | no | 0px | “Mark fixed” ×8 | quiet | Mapped |
| 11 | 28×91 | Cormorant Garamond 16px/600 | none | no | 0px | “Cultivars 79” ×7 | quiet | Mapped |
| 12 | 28×49 | Lora 10px/400 caps | none | no | 0px | “TYPE” ×6 | tab | Mapped |
| 13 | 52×54 | Lora 16px/400 | rgb(83, 72, 59) | yes | 2px | “— Save” ×6 | (not a button: row, card or tile link) | Exempt |
| 14 | 36×116 | Lora 16px/400 | none | yes | 6px | “50g $12” ×6 | secondary | Mapped |
| 15 | 40×49 | Lora 16px/400 | none | no | 4px | “WEIGH” ×6 | quiet | Mapped |
| 16 | 32×110 | Plus Jakarta Sans 12px/600 | rgb(168, 135, 77) | no | 4px | “New Article” ×6 | primary | Done |
| 17 | 36×117 | Plus Jakarta Sans 12px/400 | none | yes | 6px | “Finish profile” ×5 | secondary | Mapped |
| 18 | 28×28 | Lora 16px/400 | none | no | 0px | “Switch to light mode” ×4 | icon | Mapped |
| 19 | 21×21 | Plus Jakarta Sans 16px/400 | none | no | 0px | “” ×4 | icon | Mapped |
| 20 | 24×61 | Plus Jakarta Sans 10px/600 | none | no | 0px | “Cultivar” ×4 | quiet | Mapped |
| 21 | 32×32 | Lora 16px/400 | none | no | 0px | “Close” ×3 | icon | Mapped |
| 22 | 28×86 | Lora 11px/400 caps | none | no | 0px | “INTEGRITY” ×3 | tab | Mapped |
| 23 | 28×75 | Plus Jakarta Sans 12px/600 | none | no | 0px | “Upcoming 0” ×3 | quiet | Mapped |
| 24 | 28×67 | Lora 11px/400 caps | none | no | 6px | “RATING” ×3 | tab | Mapped |
| 25 | 44×44 | Lora 16px/400 | none | no | 12px | “Open Phone Sample Oolong” ×3 | icon | Mapped |
| 26 | 21×210 | Lora 14px/400 | none | no | 0px | “Phone Sample Oolong 0757” ×3 | quiet | Mapped |
| 27 | 32×83 | Lora 12px/400 | rgba(168, 135, 77, 0.06) | yes | 3px | “$ USD” ×2 | field | Mapped |
| 28 | 39×28 | Lora 10px/600 caps | none | no | 0px | “TEA” ×2 | tab | Mapped |
| 29 | 39×39 | Lora 10px/400 caps | none | no | 0px | “LIKED” ×2 | icon | Mapped |
| 30 | 44×44 | Lora 16px/400 | none | no | 6px | “Search teas” ×2 | icon | Mapped |
| 31 | 36×41 | Lora 10px/500 caps | rgba(168, 135, 77, 0.1) | no | 0px | “50G” ×2 | icon | Mapped |
| 32 | 36×47 | Lora 10px/500 caps | none | no | 0px | “100G” ×2 | tab | Mapped |
| 33 | 32×133 | Lora 12px/600 | rgb(50, 46, 41) | yes | 9999px | “Sandbox Bali” ×2 | secondary | Mapped |
| 34 | 80×80 | Lora 16px/400 | rgb(50, 46, 41) | yes | 9999px | “S” ×2 | (not a button: row, card or tile link) | Exempt |
| 35 | 39×116 | Cormorant Garamond 15px/400 | none | no | 0px | “8 site problems to fix.” ×2 | quiet | Mapped |
| 36 | 40×106 | Lora 12px/600 | rgb(50, 46, 41) | yes | 6px | “WhatsApp” ×2 | secondary | Mapped |
| 37 | 36×54 | Lora 16px/400 | none | no | 0px | “Upcoming” ×2 | quiet | Mapped |
| 38 | 28×85 | Plus Jakarta Sans 11px/500 caps | none | no | 0px | “BY COUNTRY” ×2 | tab | Mapped |
| 39 | 36×68 | Plus Jakarta Sans 13px/600 | rgb(168, 135, 77) | no | 4px | “Begin” ×2 | primary | Done |
| 40 | 32×67 | Plus Jakarta Sans 12px/400 | none | no | 0px | “Tracking 4” ×2 | quiet | Mapped |
| 41 | 28×28 | Plus Jakarta Sans 16px/400 | none | no | 6px | “Refresh launch status” ×2 | icon | Mapped |
| 42 | 28×54 | Plus Jakarta Sans 11px/500 caps | rgba(168, 135, 77, 0.1) | no | 6px | “ALL 2” ×2 | chip | Mapped |
| 43 | 28×64 | Plus Jakarta Sans 12px/400 | none | no | 6px | “Tastings” ×2 | quiet | Mapped |
| 44 | 28×69 | Lora 11px/500 caps | rgba(168, 135, 77, 0.1) | no | 6px | “RECENT” ×2 | chip | Mapped |
| 45 | 40×113 | Lora 11px/400 | none | no | 0px | “What is Teajia?” ×1 | quiet | Mapped |
| 46 | 52×449 | Cormorant Garamond 38px/400 | none | no | 0px | “Tea House Design & Curat” ×1 | (not a button: row, card or tile link) | Exempt |
| 47 | 400×414 | Lora 16px/400 | none | yes | 0px | “START HERE Start a conve” ×1 | (not a button: row, card or tile link) | Exempt |
| 48 | 43×65 | Plus Jakarta Sans 16px/400 | none | no | 0px | “EDIT” ×1 | quiet | Mapped |
| 49 | 34×63 | Lora 12px/600 | none | no | 0px | “Cancel” ×1 | quiet | Mapped |
| 50 | 40×36 | Plus Jakarta Sans 12px/400 | none | no | 0px | “Open purchase from Fixtu” ×1 | icon | Mapped |
| 51 | 30×60 | Plus Jakarta Sans 12px/400 | none | no | 12px | “Cols” ×1 | quiet | Mapped |
| 52 | 28×28 | Plus Jakarta Sans 16px/400 | none | no | 12px | “More options” ×1 | icon | Mapped |
| 53 | 40×70 | Plus Jakarta Sans 12px/600 | rgb(168, 135, 77) | no | 6px | “New” ×1 | primary | Mapped |
| 54 | 28×115 | Plus Jakarta Sans 14px/500 | rgba(168, 135, 77, 0.1) | yes | 6px | “Browse base” ×1 | chip | Mapped |
| 55 | 28×143 | Plus Jakarta Sans 14px/500 | none | yes | 6px | “Reference issues” ×1 | chip | Mapped |
| 56 | 36×1200 | Plus Jakarta Sans 16px/400 | none | no | 0px | “Anji Bai Cha 安吉白茶 China ” ×1 | (not a button: row, card or tile link) | Exempt |
| 57 | 32×139 | Plus Jakarta Sans 12px/600 | none | yes | 6px | “Story workshop” ×1 | secondary | Mapped |
| 58 | 28×47 | Lora 12px/400 | none | no | 0px | “Back” ×1 | quiet | Mapped |
| 59 | 28×192 | Lora 13px/400 | none | no | 4px | “Light” ×1 | quiet | Mapped |
| 60 | 28×192 | Lora 13px/400 | rgb(168, 135, 77) | no | 4px | “Dark” ×1 | primary | Mapped |
