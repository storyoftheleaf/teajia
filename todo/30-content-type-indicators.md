# T2-10: Add Content-Type Indicators to Story Cards

**Status:** [ ] Not started
**Priority:** High
**Group:** D (Content & Navigation)
**Files:** `src/components/MagazineTabbed.tsx`, `src/components/HomePage.tsx` (Latest Stories grid)

## Problem
Story cards on Magazine and Homepage don't indicate whether they lead to an article, video, audio, or photo essay. Users click expecting one thing and get another.

## Requirements
- Add a small icon badge to each story card indicating content type
- Types: Article (text icon), Video/Reel (play icon), Audio (headphone icon), Photo Essay (camera icon)
- Show estimated duration: "5 min read", "3 min watch", "12 min listen"
- Consistent across Homepage Latest Stories and Magazine tabs

## Implementation Notes
- Stories already have a `contentType` or similar field — check the Story type definition
- Use lucide-react icons (already in project): `FileText`, `Play`, `Headphones`, `Camera`
- Badge position: top-left corner of card image or below title
- Duration can be estimated from word count (articles) or media duration (video/audio)

## Acceptance Criteria
- [ ] Every story card shows content type icon
- [ ] Duration/time estimate is visible
- [ ] Icons are consistent across all card locations
- [ ] Users know what experience they'll get before clicking
