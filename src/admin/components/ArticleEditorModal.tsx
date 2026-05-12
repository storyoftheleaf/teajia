import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Save, Loader2, Plus, Trash2, ArrowUp, ArrowDown,
  ChevronDown, ChevronUp, Eye, EyeOff,
  Bold, Italic, Underline, Link as LinkIcon, Quote, Heading1, Heading2, List, Image as ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { EDITABLE_ARTICLE_BLOCK_TYPES, getArticleBlockLabel } from '../../lib/articleBlockRegistry';
import { useToast } from './Toast';
import type { DbArticle, ArticleBlock } from '../../types';

interface ArticleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: DbArticle;
  onSaved?: () => void;
}

// ─── Paste parser ────────────────────────────────────────────────────────────

function parsePasteFormat(raw: string): {
  blocks: ArticleBlock[];
  title?: string;
  subtitle?: string;
  author?: string;
} {
  const blocks: ArticleBlock[] = [];
  let title: string | undefined;
  let subtitle: string | undefined;
  let author: string | undefined;

  const sections = raw.split(/^---$/m).map(s => s.trim()).filter(Boolean);

  for (const section of sections) {
    if (section.startsWith('TITLE:')) {
      title = section.replace(/^TITLE:\s*/, '').trim();
      continue;
    }
    if (section.startsWith('SUBTITLE:')) {
      subtitle = section.replace(/^SUBTITLE:\s*/, '').trim();
      continue;
    }
    if (section.startsWith('AUTHOR:')) {
      author = section.replace(/^AUTHOR:\s*/, '').trim();
      continue;
    }

    if (section.startsWith('INTRO\n')) {
      blocks.push({ type: 'intro', text: section.replace(/^INTRO\n/, '').trim() });
    } else if (section.startsWith('SECTION:')) {
      const lines = section.split('\n');
      const heading = lines[0].replace('SECTION:', '').trim();
      const body = lines.slice(1).join('\n').trim();
      blocks.push({ type: 'section_heading', text: heading });
      if (body) blocks.push({ type: 'paragraph', text: body });
    } else if (section.startsWith('QUOTE:')) {
      const text = section.replace(/^QUOTE:\s*["“]?/, '').replace(/["”]$/, '').trim();
      blocks.push({ type: 'quote', text });
    } else if (section.startsWith('IMAGE:')) {
      const lines = section.split('\n');
      const desc = lines[0].replace('IMAGE:', '').trim();
      const captionLine = lines.find(l => l.startsWith('CAPTION:'));
      const caption = captionLine?.replace('CAPTION:', '').trim();
      blocks.push({ type: 'image', description: desc, caption });
    } else if (section === 'DIVIDER') {
      blocks.push({ type: 'divider' });
    } else if (section.trim()) {
      blocks.push({ type: 'paragraph', text: section.trim() });
    }
  }
  return { blocks, title, subtitle, author };
}

// ─── Shared input styles (boxed, design system) ─────────────────────────────

const inputClass =
  'w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 transition-colors [color-scheme:dark]';
const textareaClass =
  'w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 transition-colors resize-y';
const selectClass =
  'w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:outline-none appearance-none cursor-pointer pr-8 [color-scheme:dark]';

const Field = ({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <label className="block label-caps text-tea-text-sec mb-1.5">{label}</label>
    {children}
  </div>
);

// ─── Rich text toolbar ──────────────────────────────────────────────────────

interface RichTextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ textareaRef, value, onChange }) => {
  const wrap = (before: string, after: string = before) => {
    const ta = textareaRef.current;
    if (!ta) { onChange(value + before + after); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  };

  const linePrefix = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) { onChange(prefix + value); return; }
    const start = ta.selectionStart;
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const insertLink = () => {
    const url = window.prompt('Link URL');
    if (!url) return;
    wrap('[', `](${url})`);
  };

  const tools: { icon: React.ComponentType<{ size?: number }>; title: string; action: () => void }[] = [
    { icon: Bold, title: 'Bold', action: () => wrap('**') },
    { icon: Italic, title: 'Italic', action: () => wrap('*') },
    { icon: Underline, title: 'Underline', action: () => wrap('<u>', '</u>') },
    { icon: LinkIcon, title: 'Link', action: insertLink },
    { icon: Quote, title: 'Quote', action: () => linePrefix('> ') },
    { icon: Heading1, title: 'Heading 1', action: () => linePrefix('# ') },
    { icon: Heading2, title: 'Heading 2', action: () => linePrefix('## ') },
    { icon: List, title: 'List', action: () => linePrefix('- ') },
    { icon: ImageIcon, title: 'Image', action: () => wrap('![', '](url)') },
  ];

  return (
    <div className="flex items-center gap-0.5 px-1 py-1 border border-tea-border rounded-md bg-tea-bg/60 flex-wrap">
      {tools.map(({ icon: Icon, title, action }) => (
        <button
          key={title}
          type="button"
          onClick={action}
          title={title}
          className="tap-target p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors"
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
};

// ─── Single block editor ─────────────────────────────────────────────────────

interface BlockEditorProps {
  block: ArticleBlock;
  index: number;
  total: number;
  onChange: (updated: ArticleBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ block, index, total, onChange, onDelete, onMoveUp, onMoveDown }) => {
  const textRef = useRef<HTMLTextAreaElement>(null);

  const renderFields = () => {
    switch (block.type) {
      case 'intro':
        return (
          <div className="space-y-2">
            <RichTextToolbar
              textareaRef={textRef}
              value={block.text}
              onChange={next => onChange({ ...block, text: next })}
            />
            <textarea
              ref={textRef}
              value={block.text}
              onChange={e => onChange({ ...block, text: e.target.value })}
              placeholder="Introductory paragraph…"
              className={`${textareaClass} min-h-[96px] text-ui-15 leading-relaxed italic`}
              rows={4}
            />
          </div>
        );
      case 'paragraph':
        return (
          <div className="space-y-2">
            <RichTextToolbar
              textareaRef={textRef}
              value={block.text}
              onChange={next => onChange({ ...block, text: next })}
            />
            <textarea
              ref={textRef}
              value={block.text}
              onChange={e => onChange({ ...block, text: e.target.value })}
              placeholder="Paragraph text…"
              className={`${textareaClass} min-h-[80px]`}
              rows={3}
            />
          </div>
        );
      case 'section_heading':
        return (
          <input
            type="text"
            value={block.text}
            onChange={e => onChange({ ...block, text: e.target.value })}
            placeholder="Section heading…"
            className={`${inputClass} text-ui-16 font-semibold`}
          />
        );
      case 'quote':
        return (
          <div className="space-y-2">
            <textarea
              value={block.text}
              onChange={e => onChange({ ...block, text: e.target.value })}
              placeholder="Quote text…"
              className={`${textareaClass} min-h-[64px] italic`}
              rows={2}
            />
            <input
              type="text"
              value={block.attribution ?? ''}
              onChange={e => onChange({ ...block, attribution: e.target.value })}
              placeholder="Attribution (optional)"
              className={`${inputClass} text-ui-12`}
            />
          </div>
        );
      case 'image':
        return (
          <div className="space-y-2">
            <input
              type="url"
              value={block.url ?? ''}
              onChange={e => onChange({ ...block, url: e.target.value })}
              placeholder="Image URL (optional)"
              className={inputClass}
            />
            <input
              type="text"
              value={block.description}
              onChange={e => onChange({ ...block, description: e.target.value })}
              placeholder="Alt description (required)"
              className={inputClass}
            />
            <input
              type="text"
              value={block.caption ?? ''}
              onChange={e => onChange({ ...block, caption: e.target.value })}
              placeholder="Caption (optional)"
              className={`${inputClass} text-ui-12`}
            />
            {block.url && (
              <div className="mt-2">
                <img src={block.url} alt={block.description} className="max-h-32 rounded-md border border-tea-border object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
        );
      case 'divider':
        return <div className="py-3 text-center"><div className="h-px bg-tea-border" /></div>;
      default:
        return (
          <div className="rounded-md border border-tea-border bg-tea-surface/40 p-3">
            <p className="text-ui-12 text-tea-text-sec leading-relaxed mb-2">
              This richer magazine page is preserved exactly, but it is edited from the advanced page composer.
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-ui-11 leading-relaxed text-tea-text-sec">
              {JSON.stringify(block, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="group relative bg-tea-elevated/40 border border-tea-border rounded-lg p-3 space-y-2">
      {/* Block header row */}
      <div className="flex items-center justify-between">
        <span className="label-caps text-tea-text-dim">
          {getArticleBlockLabel(block.type)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="tap-target p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-40"
            title="Move up"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="tap-target p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-40"
            title="Move down"
          >
            <ArrowDown size={12} />
          </button>
          <button
            onClick={onDelete}
            className="tap-target p-1.5 rounded-md text-tea-text-dim hover:text-tea-error transition-colors ml-1"
            title="Delete block"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {renderFields()}
    </div>
  );
};

// ─── Add block dropdown ───────────────────────────────────────────────────────

const ADD_BLOCK_OPTIONS: { type: ArticleBlock['type']; label: string }[] = EDITABLE_ARTICLE_BLOCK_TYPES
  .filter(type => type !== 'intro')
  .map(type => ({ type, label: getArticleBlockLabel(type) }));

function makeEmptyBlock(type: ArticleBlock['type']): ArticleBlock {
  switch (type) {
    case 'intro': return { type: 'intro', text: '' };
    case 'paragraph': return { type: 'paragraph', text: '' };
    case 'section_heading': return { type: 'section_heading', text: '' };
    case 'quote': return { type: 'quote', text: '', attribution: '' };
    case 'image': return { type: 'image', description: '', url: '', caption: '' };
    case 'divider': return { type: 'divider' };
    default: return { type: 'paragraph', text: '' };
  }
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSaved,
}) => {
  const { showToast } = useToast();

  // Article id (null = new unsaved article)
  const [articleId, setArticleId] = useState<string | null>(initialData?.id ?? null);

  // Header fields
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [status, setStatus] = useState<DbArticle['status']>(initialData?.status ?? 'draft');

  // Blocks
  const [blocks, setBlocks] = useState<ArticleBlock[]>(initialData?.blocks ?? []);

  // Metadata
  const [subtitle, setSubtitle] = useState(initialData?.subtitle ?? '');
  const [author, setAuthor] = useState(initialData?.author_id ?? '');
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [tagsInput, setTagsInput] = useState((initialData?.tags ?? []).join(', '));
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.cover_image_url ?? '');
  const [layoutTemplate, setLayoutTemplate] = useState(initialData?.layout_template ?? 'default');

  // Paste panel
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Add block dropdown
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const addBlockRef = useRef<HTMLDivElement>(null);

  // Save state
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [publishing, setPublishing] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close add-block dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addBlockRef.current && !addBlockRef.current.contains(e.target as Node)) {
        setAddBlockOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build save payload
  const buildPayload = useCallback(() => ({
    title: title.trim(),
    subtitle: subtitle.trim() || undefined,
    author_id: author.trim() || undefined,
    slug: title.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') || `article-${Date.now()}`,
    status,
    category: category || undefined,
    tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    cover_image_url: coverImageUrl.trim() || undefined,
    blocks,
    layout_template: layoutTemplate,
    reading_time_mins: Math.max(1, Math.round(blocks.reduce((acc, b) => {
      if ('text' in b) return acc + b.text.split(/\s+/).length;
      return acc;
    }, 0) / 200)),
  }), [title, subtitle, author, status, category, tagsInput, coverImageUrl, blocks, layoutTemplate]);

  // Save (create or update)
  const save = useCallback(async () => {
    if (!title.trim()) return;
    setSaveState('saving');
    try {
      const payload = buildPayload();
      if (articleId) {
        await api.articles.update(articleId, payload);
      } else {
        const result = await api.articles.create(payload);
        if (result?.id) setArticleId(result.id);
      }
      setSaveState('saved');
      onSaved?.();
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err: any) {
      setSaveState('idle');
      showToast(err.message || 'Save failed', 'error');
    }
  }, [articleId, buildPayload, title, onSaved, showToast]);

  // Auto-save on field change (debounced 1.5s) — only when we have a title
  const scheduleAutoSave = useCallback(() => {
    if (!title.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { void save(); }, 1500);
  }, [save, title]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  // Publish / unpublish
  const handlePublishToggle = async () => {
    if (!articleId) {
      showToast('Save the article first', 'error');
      return;
    }
    setPublishing(true);
    try {
      if (status === 'published') {
        await api.articles.unpublish(articleId);
        setStatus('draft');
        showToast('Article unpublished', 'info');
      } else {
        await api.articles.publish(articleId);
        setStatus('published');
        showToast('Article published', 'success');
      }
      onSaved?.();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setPublishing(false);
    }
  };

  // Block operations
  const updateBlock = (index: number, updated: ArticleBlock) => {
    setBlocks(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    scheduleAutoSave();
  };

  const deleteBlock = (index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index));
    scheduleAutoSave();
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const next = [...prev];
      const swap = direction === 'up' ? index - 1 : index + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
    scheduleAutoSave();
  };

  const addBlock = (type: ArticleBlock['type']) => {
    setBlocks(prev => [...prev, makeEmptyBlock(type)]);
    setAddBlockOpen(false);
    scheduleAutoSave();
  };

  // Smart paste
  const handleParse = () => {
    if (!pasteText.trim()) return;
    const { blocks: newBlocks, title: t, subtitle: s, author: a } = parsePasteFormat(pasteText);
    setBlocks(newBlocks);
    if (t) setTitle(t);
    if (s) setSubtitle(s);
    if (a) setAuthor(a);
    setPasteText('');
    setPasteOpen(false);
    showToast(`${newBlocks.length} block${newBlocks.length !== 1 ? 's' : ''} created from paste.`, 'success');
    scheduleAutoSave();
  };

  const STATUS_BADGE_STYLES: Record<string, string> = {
    draft: 'bg-tea-elevated text-tea-text-sec',
    published: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
    archived: 'bg-tea-elevated text-tea-text-dim',
  };

  const CATEGORIES = [
    '', 'Origin Story', 'Interview', 'Technique', 'Culture', 'Tea & Food', 'Photo Essay',
  ];
  const LAYOUT_TEMPLATES = [
    { value: 'default', label: 'Default' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'dark', label: 'Dark' },
    { value: 'interview', label: 'Interview' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Centered modal: rounded-xl + shadow-2xl per design system */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-tea-surface border border-tea-border rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Article editor"
      >
        {/* Header: .h3 title left, close-X top-RIGHT */}
        <div className="flex items-start justify-between gap-4 px-5 md:px-6 py-4 border-b border-tea-border flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="h3 truncate">
              {articleId ? 'Edit Article' : 'New Article'}
            </h2>
            <p className="label-caps text-tea-text-dim mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 font-sans uppercase tracking-caps mr-2 ${STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.draft}`}>
                {status}
              </span>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : articleId ? 'Auto-saves on edit' : 'Unsaved'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="tap-target p-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
            title="Close"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 space-y-6">

          {/* Title + Subtitle */}
          <section className="space-y-4">
            <Field label="Title">
              <input
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); scheduleAutoSave(); }}
                placeholder="Article title"
                className={`${inputClass} text-ui-16 font-semibold`}
              />
            </Field>

            <Field label="Subtitle">
              <input
                type="text"
                value={subtitle}
                onChange={e => { setSubtitle(e.target.value); scheduleAutoSave(); }}
                placeholder="Short subtitle…"
                className={inputClass}
              />
            </Field>
          </section>

          {/* Blocks */}
          <section>
            <h3 className="label-caps text-tea-text-sec mb-1.5">Blocks</h3>
            <div className="space-y-3">
              {blocks.length === 0 && (
                <div className="py-12 text-center text-tea-text-dim text-ui-13 border border-dashed border-tea-border rounded-lg">
                  No blocks yet. Add one below or paste from Claude.
                </div>
              )}

              <AnimatePresence initial={false}>
                {blocks.map((block, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <BlockEditor
                      block={block}
                      index={i}
                      total={blocks.length}
                      onChange={updated => updateBlock(i, updated)}
                      onDelete={() => deleteBlock(i)}
                      onMoveUp={() => moveBlock(i, 'up')}
                      onMoveDown={() => moveBlock(i, 'down')}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add block */}
              <div className="relative" ref={addBlockRef}>
                <button
                  onClick={() => setAddBlockOpen(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-text-sec transition-colors text-ui-12 w-full justify-center"
                >
                  <Plus size={13} />
                  Add Block
                  <ChevronDown size={12} className={`ml-1 transition-transform ${addBlockOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {addBlockOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-border rounded-lg shadow-lg z-10 overflow-hidden"
                    >
                      {ADD_BLOCK_OPTIONS.map(opt => (
                        <button
                          key={opt.type}
                          onClick={() => addBlock(opt.type)}
                          className="w-full text-left px-4 py-2.5 text-ui-14 text-tea-text hover:bg-tea-elevated transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>

          {/* Metadata */}
          <section>
            <h3 className="label-caps text-tea-text-sec mb-1.5">Metadata</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Author">
                <input
                  type="text"
                  value={author}
                  onChange={e => { setAuthor(e.target.value); scheduleAutoSave(); }}
                  placeholder="Author name or ID…"
                  className={inputClass}
                />
              </Field>

              <Field label="Category">
                <div className="relative">
                  <select
                    value={category}
                    onChange={e => { setCategory(e.target.value); scheduleAutoSave(); }}
                    className={selectClass}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-tea-surface text-tea-text">
                        {c || '— Select category —'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                </div>
              </Field>

              <Field label="Layout template">
                <div className="relative">
                  <select
                    value={layoutTemplate}
                    onChange={e => { setLayoutTemplate(e.target.value); scheduleAutoSave(); }}
                    className={selectClass}
                  >
                    {LAYOUT_TEMPLATES.map(t => (
                      <option key={t.value} value={t.value} className="bg-tea-surface text-tea-text">{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                </div>
              </Field>

              <Field label="Tags (comma-separated)">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={e => { setTagsInput(e.target.value); scheduleAutoSave(); }}
                  placeholder="oolong, taiwan, high mountain"
                  className={inputClass}
                />
              </Field>

              <Field label="Cover image URL" className="sm:col-span-2">
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={e => { setCoverImageUrl(e.target.value); scheduleAutoSave(); }}
                  placeholder="https://…"
                  className={inputClass}
                />
                {coverImageUrl && (
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="mt-2 w-full max-h-40 object-cover rounded-md border border-tea-border"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </Field>
            </div>
            {tagsInput.trim() && (
              <div className="flex flex-wrap gap-1 mt-3">
                {tagsInput.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="text-ui-10 px-2 py-0.5 rounded-full bg-tea-elevated text-tea-text-sec">{tag}</span>
                ))}
              </div>
            )}
          </section>

          {/* Smart Paste (collapsible) */}
          <section className="border-t border-tea-border pt-5">
            <button
              onClick={() => setPasteOpen(v => !v)}
              className="flex items-center gap-2 w-full text-left"
            >
              <h3 className="label-caps text-tea-text-sec flex-1">Paste from Claude</h3>
              {pasteOpen ? <ChevronUp size={13} className="text-tea-text-dim" /> : <ChevronDown size={13} className="text-tea-text-dim" />}
            </button>

            <AnimatePresence initial={false}>
              {pasteOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    <p className="text-ui-11 text-tea-text-dim leading-relaxed">
                      Structure with AI first, then paste here. Use the block format:
                      <code className="ml-1 px-1 bg-tea-elevated rounded text-tea-text-sec">INTRO</code>,{' '}
                      <code className="px-1 bg-tea-elevated rounded text-tea-text-sec">SECTION:</code>,{' '}
                      <code className="px-1 bg-tea-elevated rounded text-tea-text-sec">QUOTE:</code> separated by{' '}
                      <code className="px-1 bg-tea-elevated rounded text-tea-text-sec">---</code>
                    </p>
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={`TITLE: My Article\n---\nINTRO\nAn opening paragraph…\n---\nSECTION: First heading\nBody text here.\n---\nQUOTE: A memorable line\n---`}
                      className={`${textareaClass} min-h-[160px] text-ui-12 font-mono`}
                      rows={10}
                    />
                    <button
                      onClick={handleParse}
                      disabled={!pasteText.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Parse Into Blocks
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

        {/* Footer: Cancel-left ghost + Save-right primary (justify-between) */}
        <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-3 border-t border-tea-border bg-tea-bg/40 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-tea-text-sec hover:text-tea-text px-3 py-1.5 rounded-md transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePublishToggle}
              disabled={publishing || !articleId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub"
              title={!articleId ? 'Save the article first' : status === 'published' ? 'Unpublish' : 'Publish'}
            >
              {publishing ? <Loader2 size={13} className="animate-spin" /> : status === 'published' ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{status === 'published' ? 'Unpublish' : 'Publish'}</span>
            </button>

            <button
              onClick={() => { void save(); }}
              disabled={saveState === 'saving' || !title.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saveState === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
