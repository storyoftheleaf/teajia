// src/pages/ArticleEditorHarness.tsx
// Dev-only mount of the real ArticleEditorModal so the block-stack authoring UI
// (AR.5) can be exercised without the full admin auth shell. Mirrors the
// /design/* preview convention. The save path is stubbed to surface the payload
// the editor would persist (window.__lastArticlePayload), so a test can assert
// that the render-mode toggle writes layout_template === 'immersive_scroll'.
// Not linked anywhere; reachable only at /design/article-editor in dev.
import { useState } from 'react';
import { ArticleEditorModal } from '../admin/components/ArticleEditorModal';
import type { DbArticle } from '../types';

const SAMPLE: DbArticle = {
  id: 'harness-article',
  title: 'The Rock Remembers',
  subtitle: 'Wuyi, and the long lesson of fire',
  slug: 'the-rock-remembers',
  status: 'draft',
  tags: ['wuyi', 'oolong'],
  layout_template: 'default',
  created_at: '2026-06-16',
  updated_at: '2026-06-16',
  blocks: [
    { type: 'cover', title: 'The Rock Remembers', kicker: 'Origin · Wuyi' },
    { type: 'intro', text: 'Some teas taste of the place that made them. Wuyi is one of them, and it took me years to learn how to hear it.' },
    { type: 'section_heading', text: 'Then comes the fire.' },
    { type: 'paragraph', text: 'By the third pass the green has gone entirely, folded down into warm stone and dried longan and a faint mineral sweetness underneath.' },
    { type: 'image', variant: 'full_bleed', description: 'Wuyi cliffs', caption: 'Cliffs at dawn' },
    { type: 'quote', text: 'You do not drink the leaf. You drink the mountain.', attribution: 'Master Chen' },
  ],
};

export default function ArticleEditorHarness() {
  const [open, setOpen] = useState(true);
  if (!import.meta.env.DEV) {
    return <div className="min-h-[100dvh] bg-tea-bg flex items-center justify-center text-tea-text-dim">Not available</div>;
  }
  return (
    <div className="min-h-[100dvh] bg-tea-bg" data-testid="article-editor-harness">
      <ArticleEditorModal
        isOpen={open}
        onClose={() => setOpen(false)}
        initialData={SAMPLE}
        onSaved={() => {}}
      />
    </div>
  );
}
