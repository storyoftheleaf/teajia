import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icons } from '../components/Icons';
import { BookOpen, X as XIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { SavedCollectionRow } from '../types';

// The logged-in user's shelf of collections — ones sent to them via a shared
// link ('received') or that they explicitly saved ('saved'). Cross-account:
// these can come from any curator. Each card deep-links back to the /c/:slug
// link they arrived through so they can re-open and order.
export default function SharedCollectionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-collections'],
    queryFn: () => api.collections.listMine(),
    select: d => d.collections,
  });

  const rows: SavedCollectionRow[] = data ?? [];

  const open = (row: SavedCollectionRow) => {
    if (row.slug) navigate(`/c/${row.slug}`);
  };

  const remove = async (e: React.MouseEvent, collectionId: string) => {
    e.stopPropagation();
    await api.collections.unsaveMine(collectionId);
    queryClient.invalidateQueries({ queryKey: ['my-collections'] });
  };

  const showEmpty = !isLoading && rows.length === 0;

  return (
    <div className="max-w-sm mx-auto pt-12 pb-nav-gap px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8 tap-target"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      <h1 className="font-display text-3xl text-tea-text mb-1">Collections</h1>
      <p className="font-body italic text-ui-14 text-tea-text-dim mb-8">
        {isLoading ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'collection' : 'collections'} shared with you`}
      </p>

      {isLoading ? (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-3 ${i < 2 ? 'border-b border-tea-border' : ''}`}>
              <div className="w-12 h-12 rounded bg-tea-surface animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3 w-3/4 bg-tea-surface animate-pulse rounded" />
                <div className="h-2.5 w-1/2 bg-tea-surface animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : showEmpty ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-tea-gold/40" />
          </div>
          <h3 className="font-serif text-lg text-tea-text mb-2">No collections yet</h3>
          <p className="text-ui-14 text-tea-text-sec text-center max-w-[260px] leading-relaxed">
            When someone shares a curated collection with you, it lands here so you can open it any time.
          </p>
        </div>
      ) : (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {rows.map((row, i) => (
            <button
              key={row.id}
              onClick={() => open(row)}
              disabled={!row.slug}
              className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-tea-surface/50 transition-colors group text-left disabled:cursor-default ${
                i < rows.length - 1 ? 'border-b border-tea-border' : ''
              }`}
            >
              {row.hero_image_url || row.thumbnails[0] ? (
                <img
                  src={row.hero_image_url || row.thumbnails[0]}
                  alt=""
                  loading="lazy"
                  className="w-12 h-12 rounded object-cover shrink-0 bg-tea-surface"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-tea-surface flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-tea-gold" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-serif text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors truncate">
                  {row.title}
                </div>
                <div className="font-body text-ui-12 text-tea-text-sec truncate mt-0.5">
                  {row.curator_display_name ? `${row.curator_display_name} · ` : ''}
                  {row.item_count} {row.item_count === 1 ? 'tea' : 'teas'}
                  {row.source === 'saved' ? ' · saved' : ''}
                </div>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => remove(e, row.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') remove(e as unknown as React.MouseEvent, row.id); }}
                className="text-tea-text-sec hover:text-tea-text transition-colors shrink-0 tap-target"
                aria-label={`Remove ${row.title} from your collections`}
              >
                <XIcon className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
