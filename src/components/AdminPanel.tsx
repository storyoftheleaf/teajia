
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Story, ContentType, LayoutVariant, StoryStatus, InventoryItem } from '../types';
import { useStories } from '../context/StoryContext';
import { useInventory } from '../context/InventoryContext';
import { useTheme } from '../context/ThemeContext';
import { Icons } from './Icons';
import { SinglePageRenderer } from './SinglePageRenderer';
import { fetchAndSaveExchangeRates } from '../utils/currency';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { DEFAULT_STORY, generateId, parsePagesFromStory, serializePagesToContent, PageState } from './admin-panel/pageUtils';
import { LoginScreen } from './admin-panel/LoginScreen';
import { InventoryEditor } from './admin-panel/InventoryEditor';

interface AdminPanelProps {
  onClose: () => void;
  bypassAuth?: boolean;
}


const Studio: React.FC<{ story: Story; initialPages: PageState[]; onSave: (s: Story, p: PageState[]) => void; onCancel: () => void; onDeletePage: (index: number) => void; }> = ({ story, initialPages, onSave, onCancel, onDeletePage }) => {
    const [currentStory, setCurrentStory] = useState(story);
    const [pages, setPages] = useState<PageState[]>(initialPages);
    const [idx, setIdx] = useState(0);
    const [tab, setTab] = useState<'CANVAS' | 'META'>('CANVAS');
    const [scale, setScale] = useState(1);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateSearch, setTemplateSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Dynamic Aspect Ratio based on content type
    const getCanvasDimensions = () => {
        switch (currentStory.type) {
            case ContentType.Reel: return { w: 600, h: 1067, ratio: '9/16' }; // 9:16
            case ContentType.Film: return { w: 1067, h: 600, ratio: '16/9' }; // 16:9
            case ContentType.Audio: return { w: 800, h: 800, ratio: '1/1' }; // 1:1
            default: return { w: 800, h: 1067, ratio: '3/4' }; // 3:4 (Article High Res)
        }
    };

    const { w: CANVAS_W, h: CANVAS_H } = getCanvasDimensions();
    const isMedia = currentStory.type !== ContentType.Article && currentStory.type !== ContentType.PhotoEssay;

    useEffect(() => {
        const calcScale = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                // Reduce padding on mobile to make canvas larger
                const padding = window.innerWidth < 768 ? 24 : 64;
                const s = Math.min((clientWidth - padding) / CANVAS_W, (clientHeight - padding) / CANVAS_H);
                setScale(s); 
            }
        };
        window.addEventListener('resize', calcScale);
        calcScale(); 
        const t = setTimeout(calcScale, 100); 
        return () => { window.removeEventListener('resize', calcScale); clearTimeout(t); };
    }, [tab, CANVAS_W, CANVAS_H]);

    const updatePage = (i: number, u: Partial<PageState>) => { const n = [...pages]; n[i] = { ...n[i], ...u }; setPages(n); };
    const addPage = () => { const n = [...pages, { id: generateId(), variant: LayoutVariant.TEXT_SINGLE_COL, content: 'New Page', images: [], textColor: 'light' } as PageState]; setPages(n); setIdx(n.length - 1); };
    const delPage = (i: number) => { if (pages.length > 1) onDeletePage(i); };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-tea-surface text-tea-text overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-tea-gold/10 bg-tea-bg flex items-center justify-between px-4 md:px-6 shrink-0 z-[110] shadow-md relative">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 text-tea-text hover:text-white transition-colors group px-2 py-1 rounded-sm hover:bg-tea-gold/5"
                >
                    <Icons.Back className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs uppercase tracking-[0.15em] font-bold hidden md:inline">Exit Studio</span>
                    <span className="text-xs uppercase tracking-[0.15em] font-bold md:hidden">Exit</span>
                </button>

                <div className="flex bg-tea-bg rounded-lg p-0.5 border border-tea-gold/15 absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
                    <button onClick={() => setTab('CANVAS')} className={`px-4 md:px-5 py-1.5 text-xs uppercase tracking-[0.15em] transition-all ${tab === 'CANVAS' ? 'bg-tea-gold text-tea-paper shadow-sm' : 'text-tea-text hover:text-white'}`}>
                        {isMedia ? 'Poster' : 'Canvas'}
                    </button>
                    <button onClick={() => setTab('META')} className={`px-4 md:px-5 py-1.5 text-xs uppercase tracking-[0.15em] transition-all ${tab === 'META' ? 'bg-tea-gold text-tea-paper shadow-sm' : 'text-tea-text hover:text-white'}`}>Meta</button>
                </div>

                <button 
                    onClick={() => onSave(currentStory, pages)} 
                    className="flex items-center gap-2 px-4 py-2 bg-tea-gold hover:bg-tea-gold/90 text-tea-paper rounded-sm text-xs uppercase tracking-[0.15em] transition-colors shadow-lg"
                >
                    <Icons.Check className="w-4 h-4" />
                    <span className="hidden md:inline">Save</span>
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Pages Sidebar - Only for Articles */}
                {tab === 'CANVAS' && !isMedia && (
                    <div className="hidden md:flex w-28 bg-tea-bg border-r border-tea-gold/10 flex-col overflow-y-auto no-scrollbar py-4 gap-4 items-center shrink-0 z-10">
                        {pages.map((p, i) => (
                            <div key={p.id} onClick={() => setIdx(i)} className={`relative w-20 h-[26.6px] shrink-0 border transition-all cursor-pointer ${i === idx ? 'border-tea-gold shadow-[0_0_10px_rgba(140,63,63,0.3)]' : 'border-transparent hover:border-tea-gold/15'}`}>
                                <div className="absolute inset-0 bg-tea-bg overflow-hidden pointer-events-none">
                                    <div className="w-[800px] h-[1067px] origin-top-left scale-[0.1]"> 
                                        <SinglePageRenderer page={{...p, index: i+1}} readOnly={true} />
                                    </div>
                                </div>
                                <div className="absolute bottom-0 right-0 bg-black/80 text-white text-[10px] px-1 font-mono">{i+1}</div>
                                <button onClick={(e) => { e.stopPropagation(); delPage(i); }} className="absolute -top-1 -right-1 w-4 h-4 bg-red-900 text-white rounded-full flex items-center justify-center opacity-0 hover:opacity-100 z-10" aria-label={`Delete page ${i + 1}`}><Icons.Close className="w-3 h-3" /></button>
                            </div>
                        ))}
                        <button onClick={addPage} className="w-20 h-10 border border-dashed border-tea-gold/10 flex items-center justify-center text-tea-text-dim hover:text-white hover:border-tea-gold/20"><Icons.Plus className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Main Canvas Area */}
                {tab === 'CANVAS' ? (
                    <div className="flex-1 bg-tea-bg relative flex items-center justify-center overflow-hidden" ref={containerRef}>
                        <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }} className="shadow-2xl ring-1 ring-white/10 relative group bg-tea-bg transition-all duration-300">
                             {/* Focus Ring Indication */}
                             <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover:border-blue-500/20 transition-colors z-50"></div>
                             
                             {/* For Media types, we only really edit the cover/thumbnail on the canvas */}
                             <SinglePageRenderer 
                                page={{...pages[idx], index: idx+1}} 
                                isEditable={true} 
                                onPageUpdate={(u) => updatePage(idx, u)} 
                                onStoryUpdate={(f,v) => setCurrentStory(s => ({...s, [f]: v}))} 
                                storyTitle={currentStory.title} 
                                storySubtitle={currentStory.subtitle} 
                             />
                        </div>

                        {/* Mobile Page Controls (since sidebar is hidden) */}
                         {!isMedia && (
                            <div className="md:hidden absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#202020] px-4 py-2 rounded-full border border-tea-gold/10 z-40 shadow-xl">
                                <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="text-tea-text disabled:opacity-30"><Icons.Back className="w-4 h-4" /></button>
                                <span className="text-xs text-tea-text font-mono">{idx + 1} / {pages.length}</span>
                                <button onClick={() => setIdx(Math.min(pages.length - 1, idx + 1))} disabled={idx === pages.length - 1} className="text-tea-text disabled:opacity-30"><Icons.Next className="w-4 h-4" /></button>
                                <div className="w-[1px] h-3 bg-tea-gold/15 mx-1"></div>
                                <button onClick={addPage} className="text-tea-gold"><Icons.Plus className="w-4 h-4" /></button>
                            </div>
                        )}

                        {/* Template Selector Button - Only for Articles */}
                        {!isMedia && (
                            <button
                                onClick={() => setShowTemplateModal(true)}
                                className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-2 bg-tea-gold hover:bg-tea-gold/90 text-tea-paper rounded-sm text-xs uppercase tracking-[0.15em] font-medium transition-colors z-50 shadow-lg"
                            >
                                Choose Template
                            </button>
                        )}
                        {/* Hint for Media */}
                        {isMedia && (
                            <div className="absolute bottom-8 text-tea-text-dim text-sm font-serif italic">
                                Edit poster image for {currentStory.type}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 p-8 overflow-y-auto bg-tea-bg">
                        <div className="max-w-md mx-auto space-y-6">
                            <div><label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">Title</label><input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold" value={currentStory.title} onChange={e => setCurrentStory({...currentStory, title: e.target.value})} /></div>
                            <div><label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">Subtitle</label><input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold" value={currentStory.subtitle} onChange={e => setCurrentStory({...currentStory, subtitle: e.target.value})} /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">Status</label>
                                    <select value={currentStory.status} onChange={e => setCurrentStory({...currentStory, status: e.target.value as StoryStatus})} className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold text-xs uppercase">
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                        <option value="vault">Vault (Media)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">Type</label>
                                    <select value={currentStory.type} onChange={e => setCurrentStory({...currentStory, type: e.target.value as ContentType})} className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold text-xs uppercase">
                                        {Object.values(ContentType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Media Specific Fields */}
                            {isMedia && (
                                <div className="p-4 border border-tea-gold/30 bg-tea-gold/5 rounded-sm space-y-4">
                                     <h3 className="text-xs uppercase tracking-[0.15em] text-tea-gold mb-2">Media Configuration</h3>
                                     <div>
                                        <label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">Duration</label>
                                        <input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold" placeholder="e.g. 12:30" value={currentStory.durationOrTime} onChange={e => setCurrentStory({...currentStory, durationOrTime: e.target.value})} />
                                     </div>
                                     <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">Platform</label>
                                            <select value={currentStory.platform} onChange={e => setCurrentStory({...currentStory, platform: e.target.value as any})} className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold text-xs uppercase">
                                                <option value="YouTube">YouTube</option>
                                                <option value="Instagram">Instagram</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">External ID</label>
                                            <input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold" placeholder="Video ID" value={currentStory.externalId || ''} onChange={e => setCurrentStory({...currentStory, externalId: e.target.value})} />
                                        </div>
                                     </div>
                                </div>
                            )}

                            <div><label className="text-xs uppercase text-tea-gold block mb-1 tracking-wider">Description</label><textarea className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white outline-none focus:border-tea-gold h-24" value={currentStory.description} onChange={e => setCurrentStory({...currentStory, description: e.target.value})} /></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Template Selector Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-tea-bg rounded-sm border border-tea-gold/15 max-w-4xl w-full max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="bg-tea-bg border-b border-tea-gold/15 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0">
                            <h2 className="text-lg sm:text-xl font-serif text-tea-text">Choose Template</h2>
                            <button
                                onClick={() => { setShowTemplateModal(false); setTemplateSearch(''); }}
                                className="text-tea-text hover:text-white transition-colors"
                                aria-label="Close template modal"
                            >
                                <Icons.Close className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="bg-tea-bg border-b border-tea-gold/15 px-4 sm:px-6 py-3 shrink-0">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={templateSearch}
                                    onChange={(e) => setTemplateSearch(e.target.value)}
                                    placeholder="Search templates..."
                                    className="w-full bg-tea-surface border border-tea-gold/15 rounded-sm px-4 py-2 text-sm text-white placeholder:text-tea-text-dim outline-none focus:border-tea-gold transition-colors"
                                    autoFocus
                                />
                                {templateSearch && (
                                    <button
                                        onClick={() => setTemplateSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text"
                                        aria-label="Clear search"
                                    >
                                        <Icons.Close className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Template Grid - Scrollable */}
                        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
                            {/* Covers Section */}
                            {(() => {
                                const templates = [LayoutVariant.COVER_MAIN, LayoutVariant.COVER_MINIMAL, LayoutVariant.COPYRIGHT_PAGE, LayoutVariant.DEDICATION_SIMPLE, LayoutVariant.TOC_MINIMAL];
                                const filtered = templates.filter(v => v.toLowerCase().includes(templateSearch.toLowerCase()));
                                if (filtered.length === 0 && templateSearch) return null;
                                return (
                            <div>
                                <h3 className="text-sm uppercase tracking-[0.15em] text-tea-gold mb-3 font-semibold">Covers & Front Matter</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {filtered.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                updatePage(idx, {variant: v});
                                                setShowTemplateModal(false);
                                                setTemplateSearch('');
                                            }}
                                            className="p-3 bg-tea-bg hover:bg-tea-surface border border-tea-gold/15 hover:border-tea-gold rounded-sm transition-all text-[10px] sm:text-xs uppercase text-center text-tea-text hover:text-tea-gold font-mono leading-tight"
                                        >
                                            {v.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                                );
                            })()}

                            {/* Text Section */}
                            {(() => {
                                const templates = [LayoutVariant.TEXT_SINGLE_COL, LayoutVariant.TEXT_DOUBLE_COL, LayoutVariant.TEXT_TRIPLE_COL, LayoutVariant.TEXT_DROP_CAP, LayoutVariant.TEXT_JUSTIFIED_NARROW, LayoutVariant.TEXT_BLOCKQUOTE_CENTER, LayoutVariant.TEXT_CENTER_NARROW, LayoutVariant.TEXT_INVERTED, LayoutVariant.TEXT_TYPEWRITER, LayoutVariant.TEXT_HIGHLIGHTED];
                                const filtered = templates.filter(v => v.toLowerCase().includes(templateSearch.toLowerCase()));
                                if (filtered.length === 0 && templateSearch) return null;
                                return (
                            <div>
                                <h3 className="text-sm uppercase tracking-[0.15em] text-tea-gold mb-3 font-semibold">Text Layouts</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {filtered.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                updatePage(idx, {variant: v});
                                                setShowTemplateModal(false);
                                                setTemplateSearch('');
                                            }}
                                            className="p-3 bg-tea-bg hover:bg-tea-surface border border-tea-gold/15 hover:border-tea-gold rounded-sm transition-all text-[10px] sm:text-xs uppercase text-center text-tea-text hover:text-tea-gold font-mono leading-tight"
                                        >
                                            {v.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                                );
                            })()}

                            {/* Image Section */}
                            {(() => {
                                const templates = [LayoutVariant.IMG_FULL_BLEED, LayoutVariant.IMG_FULL_BLEED_TITLE, LayoutVariant.IMG_SPLIT_HORIZONTAL, LayoutVariant.IMG_GRID_2x2, LayoutVariant.IMG_GRID_3x3, LayoutVariant.IMG_CIRCLE_MASK, LayoutVariant.IMG_OVAL_VIGNETTE, LayoutVariant.IMG_PANORAMIC, LayoutVariant.IMG_WITH_CAPTION_BOTTOM, LayoutVariant.IMG_GALLERY_MOSAIC];
                                const filtered = templates.filter(v => v.toLowerCase().includes(templateSearch.toLowerCase()));
                                if (filtered.length === 0 && templateSearch) return null;
                                return (
                            <div>
                                <h3 className="text-sm uppercase tracking-[0.15em] text-tea-gold mb-3 font-semibold">Image Layouts</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {filtered.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                updatePage(idx, {variant: v});
                                                setShowTemplateModal(false);
                                                setTemplateSearch('');
                                            }}
                                            className="p-3 bg-tea-bg hover:bg-tea-surface border border-tea-gold/15 hover:border-tea-gold rounded-sm transition-all text-[10px] sm:text-xs uppercase text-center text-tea-text hover:text-tea-gold font-mono leading-tight"
                                        >
                                            {v.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                                );
                            })()}

                            {/* Poetic Section */}
                            {(() => {
                                const templates = [LayoutVariant.POEM_CENTERED, LayoutVariant.POEM_LEFT_ALIGN, LayoutVariant.POEM_SCATTERED, LayoutVariant.QUOTE_BIG, LayoutVariant.QUOTE_MINIMAL];
                                const filtered = templates.filter(v => v.toLowerCase().includes(templateSearch.toLowerCase()));
                                if (filtered.length === 0 && templateSearch) return null;
                                return (
                            <div>
                                <h3 className="text-sm uppercase tracking-[0.15em] text-tea-gold mb-3 font-semibold">Poetic & Artsy</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {filtered.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                updatePage(idx, {variant: v});
                                                setShowTemplateModal(false);
                                                setTemplateSearch('');
                                            }}
                                            className="p-3 bg-tea-bg hover:bg-tea-surface border border-tea-gold/15 hover:border-tea-gold rounded-sm transition-all text-[10px] sm:text-xs uppercase text-center text-tea-text hover:text-tea-gold font-mono leading-tight"
                                        >
                                            {v.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                                );
                            })()}

                            {/* Editorial Section */}
                            {(() => {
                                const templates = [LayoutVariant.INTERVIEW_STANDARD, LayoutVariant.STAT_BIG_NUMBER, LayoutVariant.DATA_BAR_CHART, LayoutVariant.LIST_CHECKLIST, LayoutVariant.RECIPE_CARD];
                                const filtered = templates.filter(v => v.toLowerCase().includes(templateSearch.toLowerCase()));
                                if (filtered.length === 0 && templateSearch) return null;
                                return (
                            <div>
                                <h3 className="text-sm uppercase tracking-[0.15em] text-tea-gold mb-3 font-semibold">Editorial & Data</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {filtered.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                updatePage(idx, {variant: v});
                                                setShowTemplateModal(false);
                                                setTemplateSearch('');
                                            }}
                                            className="p-3 bg-tea-bg hover:bg-tea-surface border border-tea-gold/15 hover:border-tea-gold rounded-sm transition-all text-[10px] sm:text-xs uppercase text-center text-tea-text hover:text-tea-gold font-mono leading-tight"
                                        >
                                            {v.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                                );
                            })()}

                            {/* Tea Specific Section */}
                            {(() => {
                                const templates = [LayoutVariant.TASTING_NOTES_GRID, LayoutVariant.MAP_CARTOGRAPHY, LayoutVariant.NOTE_PAPER, LayoutVariant.BOTANICAL_SKETCH];
                                const filtered = templates.filter(v => v.toLowerCase().includes(templateSearch.toLowerCase()));
                                if (filtered.length === 0 && templateSearch) return null;
                                return (
                            <div>
                                <h3 className="text-sm uppercase tracking-[0.15em] text-tea-gold mb-3 font-semibold">Tea Specific</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {filtered.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                updatePage(idx, {variant: v});
                                                setShowTemplateModal(false);
                                                setTemplateSearch('');
                                            }}
                                            className="p-3 bg-tea-bg hover:bg-tea-surface border border-tea-gold/15 hover:border-tea-gold rounded-sm transition-all text-[10px] sm:text-xs uppercase text-center text-tea-text hover:text-tea-gold font-mono leading-tight"
                                        >
                                            {v.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                                );
                            })()}

                            {/* No Results Message */}
                            {templateSearch &&
                             !([LayoutVariant.COVER_MAIN, LayoutVariant.COVER_MINIMAL, LayoutVariant.COPYRIGHT_PAGE, LayoutVariant.DEDICATION_SIMPLE, LayoutVariant.TOC_MINIMAL].some(v => v.toLowerCase().includes(templateSearch.toLowerCase()))) &&
                             !([LayoutVariant.TEXT_SINGLE_COL, LayoutVariant.TEXT_DOUBLE_COL, LayoutVariant.TEXT_TRIPLE_COL, LayoutVariant.TEXT_DROP_CAP, LayoutVariant.TEXT_JUSTIFIED_NARROW, LayoutVariant.TEXT_BLOCKQUOTE_CENTER, LayoutVariant.TEXT_CENTER_NARROW, LayoutVariant.TEXT_INVERTED, LayoutVariant.TEXT_TYPEWRITER, LayoutVariant.TEXT_HIGHLIGHTED].some(v => v.toLowerCase().includes(templateSearch.toLowerCase()))) &&
                             !([LayoutVariant.IMG_FULL_BLEED, LayoutVariant.IMG_FULL_BLEED_TITLE, LayoutVariant.IMG_SPLIT_HORIZONTAL, LayoutVariant.IMG_GRID_2x2, LayoutVariant.IMG_GRID_3x3, LayoutVariant.IMG_CIRCLE_MASK, LayoutVariant.IMG_OVAL_VIGNETTE, LayoutVariant.IMG_PANORAMIC, LayoutVariant.IMG_WITH_CAPTION_BOTTOM, LayoutVariant.IMG_GALLERY_MOSAIC].some(v => v.toLowerCase().includes(templateSearch.toLowerCase()))) &&
                             !([LayoutVariant.POEM_CENTERED, LayoutVariant.POEM_LEFT_ALIGN, LayoutVariant.POEM_SCATTERED, LayoutVariant.QUOTE_BIG, LayoutVariant.QUOTE_MINIMAL].some(v => v.toLowerCase().includes(templateSearch.toLowerCase()))) &&
                             !([LayoutVariant.INTERVIEW_STANDARD, LayoutVariant.STAT_BIG_NUMBER, LayoutVariant.DATA_BAR_CHART, LayoutVariant.LIST_CHECKLIST, LayoutVariant.RECIPE_CARD].some(v => v.toLowerCase().includes(templateSearch.toLowerCase()))) &&
                             !([LayoutVariant.TASTING_NOTES_GRID, LayoutVariant.MAP_CARTOGRAPHY, LayoutVariant.NOTE_PAPER, LayoutVariant.BOTANICAL_SKETCH].some(v => v.toLowerCase().includes(templateSearch.toLowerCase()))) && (
                                <div className="text-center py-12">
                                    <p className="text-tea-text-sec text-sm">No templates found matching "{templateSearch}"</p>
                                    <button
                                        onClick={() => setTemplateSearch('')}
                                        className="mt-4 px-4 py-2 bg-tea-gold hover:bg-tea-gold/90 text-tea-paper text-xs uppercase tracking-[0.15em] rounded-sm transition-colors"
                                    >
                                        Clear Search
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, bypassAuth = false }) => {
  const { stories, addStory, updateStory, deleteStory } = useStories();
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useInventory();
  const [auth, setAuth] = useState(() => bypassAuth);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [initialPages, setInitialPages] = useState<PageState[]>([]);

  // Dashboard State
  const [section, setSection] = useState<'JOURNAL' | 'MEDIA' | 'INVENTORY' | 'SETTINGS'>('INVENTORY');
  const [inventoryTab, setInventoryTab] = useState<'TEA' | 'WARE'>('TEA');

  // Inventory Editor
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation Dialog State
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; type: 'story' | 'inventory' | 'page'; id?: string; index?: number; item?: Story | InventoryItem }>({ isOpen: false, type: 'story' });

  // Computed Lists
  const journalEntries = useMemo(() => stories.filter(s => s.type === ContentType.Article || s.type === ContentType.PhotoEssay), [stories]);
  const mediaEntries = useMemo(() => stories.filter(s => s.type !== ContentType.Article && s.type !== ContentType.PhotoEssay), [stories]);
  
  const teaItems = useMemo(() => inventory.filter(i => i.category === 'tea'), [inventory]);
  const wareItems = useMemo(() => inventory.filter(i => i.category === 'ware'), [inventory]);

  // Auto-refresh exchange rates every 3 hours
  useEffect(() => {
    // Fetch rates immediately when AdminPanel opens
    fetchAndSaveExchangeRates().catch(err => console.error('Failed to fetch exchange rates on open:', err));

    // Set up 3-hour auto-refresh (10,800,000 ms = 3 hours)
    const intervalId = setInterval(() => {
      fetchAndSaveExchangeRates().catch(err => console.error('Failed to auto-refresh exchange rates:', err));
    }, 10800000);

    // Clean up interval when component unmounts
    return () => clearInterval(intervalId);
  }, []);

  const handleEdit = (s: Story) => {
      setActiveStory(s);
      const p = parsePagesFromStory(s);
      setInitialPages(p.length ? p : [{id: generateId(), variant: LayoutVariant.COVER_MAIN, content: s.title, images: [s.thumbnailUrl || ''], textColor: 'light'} as PageState]);
  };

  const handleCreate = () => { handleEdit({...DEFAULT_STORY, id: generateId(), status: section === 'MEDIA' ? 'vault' : 'draft'}); };
  
  const handleSave = (s: Story, p: PageState[]) => {
      const content = serializePagesToContent(p);
      const updated = { ...s, content, thumbnailUrl: p[0]?.images?.[0] || s.thumbnailUrl };
      const exists = stories.find(ex => ex.id === updated.id);
      exists ? updateStory(updated) : addStory(updated);
      setActiveStory(null); // Exit Studio
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const storyToDelete = stories.find(s => s.id === id);
      setDeleteDialog({ isOpen: true, type: 'story', id, item: storyToDelete });
  };

  const handlePageDelete = (index: number) => {
      setDeleteDialog({ isOpen: true, type: 'page', index });
  };

  const confirmDelete = () => {
      if (deleteDialog.type === 'story' && deleteDialog.id) {
          deleteStory(deleteDialog.id);
      } else if (deleteDialog.type === 'inventory' && deleteDialog.id) {
          deleteInventoryItem(deleteDialog.id);
      } else if (deleteDialog.type === 'page' && deleteDialog.index !== undefined) {
          // Page deletion handled by updating initialPages state
          const newPages = initialPages.filter((_, i) => i !== deleteDialog.index);
          setInitialPages(newPages);
      }
      setDeleteDialog({ isOpen: false, type: 'story' });
  };

  // Inventory Handlers
  const handleInventoryEdit = (i: InventoryItem) => {
      setEditingItem(i);
  };
  const handleInventorySave = (i: InventoryItem) => {
      const exists = inventory.find(ex => ex.id === i.id);
      exists ? updateInventoryItem(i) : addInventoryItem(i);
      setEditingItem(null);
  };
  const handleInventoryDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const itemToDelete = inventory.find(i => i.id === id);
      setDeleteDialog({ isOpen: true, type: 'inventory', id, item: itemToDelete });
  };
  const handleInventoryCreate = () => {
      const isTeaItem = inventoryTab === 'TEA';
      setEditingItem({
          id: generateId(),
          category: isTeaItem ? 'tea' : 'ware',
          type: 'Type',
          name: 'New Item',
          variant: 'Variant',
          year: new Date().getFullYear().toString(),
          origin: 'Origin',
          stock_g: '0',
          cost_price: '0',
          cost_currency: 'USD',
          multiplier: 3,
          ...(isTeaItem ? { price_per_gram: '0' } : { price_50g: '0' }),
          description: '',
          tags: [],
          image: ''
      });
  };

  const handleToggleVisibility = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setHiddenItems(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) {
              newSet.delete(id);
          } else {
              newSet.add(id);
          }
          return newSet;
      });
  };

  const handleImportInventory = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string;
              const importedItems = JSON.parse(content) as InventoryItem[];

              // Validate that it's an array of items
              if (!Array.isArray(importedItems)) {
                  alert('Invalid format: Expected array of inventory items');
                  return;
              }

              // Add each item (or update if ID exists)
              let added = 0;
              importedItems.forEach(item => {
                  const exists = inventory.find(i => i.id === item.id);
                  if (exists) {
                      updateInventoryItem(item);
                  } else {
                      addInventoryItem(item);
                      added++;
                  }
              });

              alert(`Import complete! Added ${added} items, updated ${importedItems.length - added} items.`);
              if (fileInputRef.current) fileInputRef.current.value = '';
          } catch (err) {
              alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleExportInventory = () => {
      const itemsToExport = inventoryTab === 'TEA' ? teaItems : wareItems;
      const dataStr = JSON.stringify(itemsToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${inventoryTab.toLowerCase()}-inventory-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleExportStories = () => {
      const dataStr = JSON.stringify(stories, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stories-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleImportStories = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const importedStories = JSON.parse(e.target?.result as string) as Story[];
              if (!Array.isArray(importedStories)) throw new Error('Invalid format');

              let added = 0;
              importedStories.forEach(story => {
                  const existing = stories.find(s => s.id === story.id);
                  if (existing) {
                      updateStory(story);
                  } else {
                      addStory(story);
                      added++;
                  }
              });

              alert(`Import complete! Added ${added} new stories, updated ${importedStories.length - added} stories.`);
              if (event.target) event.target.value = '';
          } catch (err) {
              alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
              if (event.target) event.target.value = '';
          }
      };
      reader.readAsText(file);
  };

  if (!auth) return <LoginScreen onLogin={() => setAuth(true)} onClose={onClose} />;

  if (activeStory) return (
      <>
          <Studio story={activeStory} initialPages={initialPages} onSave={handleSave} onCancel={() => setActiveStory(null)} onDeletePage={handlePageDelete} />
          <ConfirmDialog
              isOpen={deleteDialog.isOpen}
              title="Delete Page"
              message="Are you sure you want to delete this page? This action cannot be undone."
              confirmText="Delete"
              cancelText="Cancel"
              confirmVariant="danger"
              onConfirm={confirmDelete}
              onCancel={() => setDeleteDialog({ isOpen: false, type: 'story' })}
          />
      </>
  );

  if (editingItem) return <InventoryEditor item={editingItem} onSave={handleInventorySave} onCancel={() => setEditingItem(null)} />;

  return (
    <>
    <div className="w-full h-full bg-tea-surface flex flex-col md:flex-row flex-1">

        {/* Sidebar */}
        <div className="w-full md:w-64 bg-tea-bg border-r border-tea-gold/10 flex flex-col shrink-0 h-16 md:h-full z-10">
             <div className="h-16 flex items-center justify-between px-6 border-b border-tea-gold/10 gap-3 bg-tea-bg">
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-tea-gold rounded-lg flex items-center justify-center text-black font-serif font-bold">T</div>
                     <span className="text-xs uppercase tracking-[0.15em] text-tea-text hidden md:inline">Admin</span>
                 </div>
                 <div className="flex items-center gap-2 md:hidden">
                     <button onClick={onClose} className="px-2 py-1 text-tea-text hover:text-white text-xs uppercase transition-colors" title="Exit">Exit</button>
                     <button onClick={() => setAuth(false)} className="px-2 py-1 text-red-900/70 hover:text-red-500 text-xs uppercase transition-colors" title="Logout">Logout</button>
                 </div>
             </div>

             {/* Nav Links */}
             <div className="flex flex-row md:flex-col p-2 md:p-4 gap-1 overflow-x-auto no-scrollbar">
                 <button onClick={() => setSection('JOURNAL')} className={`flex items-center gap-3 px-4 py-3 rounded-sm text-xs uppercase tracking-wider transition-colors ${section === 'JOURNAL' ? 'bg-tea-bg text-white' : 'text-tea-text hover:text-white'}`}>
                     <Icons.Book className="w-4 h-4" />
                     <span className="whitespace-nowrap">Journal</span>
                 </button>
                 <button onClick={() => setSection('MEDIA')} className={`flex items-center gap-3 px-4 py-3 rounded-sm text-xs uppercase tracking-wider transition-colors ${section === 'MEDIA' ? 'bg-tea-bg text-white' : 'text-tea-text hover:text-white'}`}>
                     <Icons.Film className="w-4 h-4" />
                     <span className="whitespace-nowrap">Media Vault</span>
                 </button>
                 <button onClick={() => setSection('INVENTORY')} className={`flex items-center gap-3 px-4 py-3 rounded-sm text-xs uppercase tracking-wider transition-colors ${section === 'INVENTORY' ? 'bg-tea-bg text-white' : 'text-tea-text hover:text-white'}`}>
                     <Icons.Grid className="w-4 h-4" />
                     <span className="whitespace-nowrap">Inventory</span>
                 </button>
                 <div className="hidden md:block border-t border-tea-gold/10 my-2"></div>
                 <button onClick={() => setSection('SETTINGS')} className={`flex items-center gap-3 px-4 py-3 rounded-sm text-xs uppercase tracking-wider transition-colors ${section === 'SETTINGS' ? 'bg-tea-bg text-white' : 'text-tea-text hover:text-white'}`}>
                     <Icons.Settings className="w-4 h-4" />
                     <span className="whitespace-nowrap">Settings</span>
                 </button>
             </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-tea-bg overflow-y-auto p-4 md:p-8 relative">
            
            {/* --- JOURNAL SECTION --- */}
            {section === 'JOURNAL' && (
                <div className="max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex justify-between items-center mb-8 border-b border-tea-gold/10 pb-4">
                        <div>
                            <h2 className="text-2xl font-serif text-tea-text mb-1">Journal Entries</h2>
                            <p className="text-tea-text text-xs uppercase tracking-wider">Managing {journalEntries.length} stories</p>
                        </div>
                        <div className="flex gap-2">
                            <input type="file" accept="application/json" onChange={handleImportStories} className="hidden" id="story-import-input" />
                            <button
                                onClick={() => document.getElementById('story-import-input')?.click()}
                                className="px-3 py-2 bg-tea-gold/10 text-tea-text text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/15 rounded-sm flex items-center gap-2"
                                title="Import stories from JSON"
                                aria-label="Import stories"
                            >
                                <Icons.Download className="w-4 h-4 rotate-180" />
                            </button>
                            <button
                                onClick={handleExportStories}
                                className="px-3 py-2 bg-tea-gold/10 text-tea-text text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/15 rounded-sm flex items-center gap-2"
                                title="Export all stories to JSON"
                                aria-label="Export stories"
                            >
                                <Icons.Download className="w-4 h-4" />
                            </button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-tea-gold text-tea-paper text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/90 rounded-sm flex items-center gap-2">
                                <Icons.Plus className="w-4 h-4" /> New Article
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {journalEntries.map(s => (
                            <div key={s.id} onClick={() => handleEdit(s)} className="aspect-[3/4] bg-tea-bg relative group cursor-pointer border border-tea-gold/10 hover:border-tea-gold transition-all">
                                {s.thumbnailUrl && <img src={s.thumbnailUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />}
                                <div className="absolute top-2 left-2 flex gap-1">
                                    <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-black/60 backdrop-blur-sm rounded-lg ${s.status === 'published' ? 'text-tea-green' : 'text-tea-text'}`}>
                                        {s.status}
                                    </span>
                                </div>
                                <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/90 to-transparent">
                                    <h3 className="text-white font-serif text-lg leading-tight line-clamp-2 mb-1">{s.title}</h3>
                                    <span className="text-[10px] uppercase text-tea-text">{s.subtitle}</span>
                                </div>
                                <button onClick={(e) => handleDelete(e, s.id)} className="absolute top-2 right-2 p-1.5 bg-red-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Trash className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MEDIA VAULT SECTION --- */}
            {section === 'MEDIA' && (
                <div className="max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex justify-between items-center mb-8 border-b border-tea-gold/10 pb-4">
                        <div>
                            <h2 className="text-2xl font-serif text-tea-text mb-1">Media Vault</h2>
                            <p className="text-tea-text text-xs uppercase tracking-wider">Reels, Films & Audio for future release</p>
                        </div>
                        <button onClick={handleCreate} className="px-4 py-2 bg-tea-gold text-tea-paper text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/90 rounded-sm flex items-center gap-2">
                            <Icons.Plus className="w-4 h-4" /> New Media
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {mediaEntries.map(s => {
                            // Determine visual aspect ratio based on type
                            let ar = 'aspect-[3/4]';
                            if (s.type === ContentType.Reel) ar = 'aspect-[9/16]';
                            if (s.type === ContentType.Film) ar = 'aspect-video';
                            if (s.type === ContentType.Audio) ar = 'aspect-square';

                            return (
                                <div key={s.id} onClick={() => handleEdit(s)} className={`relative bg-tea-bg border border-tea-gold/10 hover:border-tea-gold transition-all cursor-pointer group ${ar} overflow-hidden`}>
                                    {s.thumbnailUrl && <img src={s.thumbnailUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" alt="" />}
                                    
                                    {/* Icon Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                                        <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-tea-gold/10">
                                            {s.type === ContentType.Audio ? <Icons.Audio className="w-4 h-4 text-white" /> : <Icons.Play className="w-4 h-4 text-white" />}
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                                        <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-black/60 backdrop-blur-sm rounded-lg text-tea-text border border-tea-gold/10`}>
                                            {s.type}
                                        </span>
                                        {s.status === 'vault' && <span className="text-[10px] uppercase text-tea-gold tracking-[0.15em] bg-black/60 px-1.5 py-0.5 rounded-lg border border-tea-gold/20">Vault</span>}
                                    </div>

                                    {/* Bottom Meta */}
                                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                                        <h3 className="text-white font-serif text-lg leading-tight truncate mb-0.5">{s.title}</h3>
                                        <div className="flex items-center gap-2 text-[10px] uppercase text-tea-text tracking-wider">
                                            <span>{s.durationOrTime}</span>
                                            {s.platform && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span>{s.platform}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                     <button onClick={(e) => handleDelete(e, s.id)} className="absolute top-2 right-2 p-1.5 bg-red-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Trash className="w-3 h-3" /></button>
                                </div>
                            );
                        })}
                        {mediaEntries.length === 0 && (
                            <div className="col-span-full py-20 text-center opacity-30">
                                <Icons.Film className="w-12 h-12 mx-auto mb-4" />
                                <p>Vault is empty</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- INVENTORY SECTION (Editable) --- */}
            {section === 'INVENTORY' && (
                <div className="max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-tea-gold/10 pb-4 gap-4">
                        <div>
                            <h2 className="text-2xl font-serif text-tea-text mb-1">Ledger</h2>
                            <p className="text-tea-text text-xs uppercase tracking-wider">Global Inventory Management</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <div className="flex bg-tea-bg p-1 rounded-sm border border-tea-gold/10">
                                <button onClick={() => setInventoryTab('TEA')} className={`px-4 py-1 text-xs uppercase tracking-[0.15em] transition-colors ${inventoryTab === 'TEA' ? 'bg-tea-gold/10 text-white' : 'text-tea-text'}`}>Tea</button>
                                <button onClick={() => setInventoryTab('WARE')} className={`px-4 py-1 text-xs uppercase tracking-[0.15em] transition-colors ${inventoryTab === 'WARE' ? 'bg-tea-gold/10 text-white' : 'text-tea-text'}`}>Ware</button>
                            </div>
                            <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 bg-tea-gold/10 text-white text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/15 rounded-sm flex items-center gap-1 border border-tea-gold/15" title="Import">
                                <Icons.Download className="w-3 h-3" />
                            </button>
                            <button onClick={handleExportInventory} className="px-2 py-1 bg-tea-gold/10 text-white text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/15 rounded-sm flex items-center gap-1 border border-tea-gold/15" title="Export">
                                <Icons.ArrowUp className="w-3 h-3" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleImportInventory}
                                className="hidden"
                            />
                            <button onClick={handleInventoryCreate} className="px-4 py-1 bg-tea-gold text-tea-paper text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/90 rounded-sm flex items-center gap-2">
                                <Icons.Plus className="w-3 h-3" /> Add Item
                            </button>
                        </div>
                    </div>

                    <div className="bg-tea-bg border border-tea-gold/10 overflow-hidden rounded-sm">
                        <table className="w-full text-left text-sm text-tea-text">
                            <thead className="bg-tea-gold/5 text-xs uppercase tracking-[0.15em] text-tea-text">
                                <tr>
                                    <th className="p-4 font-normal w-12">Img</th>
                                    <th className="p-4 font-normal">Name</th>
                                    <th className="p-4 font-normal hidden md:table-cell">Origin</th>
                                    <th className="p-4 font-normal text-right">Stock</th>
                                    <th className="p-4 font-normal text-right">Price</th>
                                    <th className="p-4 font-normal text-right w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(inventoryTab === 'TEA' ? teaItems : wareItems).map((item) => {
                                    const isHidden = hiddenItems.has(item.id);
                                    return (
                                    <tr key={item.id} onClick={() => !isHidden && handleInventoryEdit(item)} className={`border-b border-tea-gold/10 transition-colors group ${isHidden ? 'opacity-40' : 'hover:bg-tea-gold/5 cursor-pointer'}`}>
                                        <td className="p-2">
                                            <div className="w-8 h-8 bg-black border border-tea-gold/15 overflow-hidden">
                                                {item.image && <img src={item.image} className="w-full h-full object-cover" />}
                                            </div>
                                        </td>
                                        <td className="p-4 font-serif text-white">
                                            {item.name}
                                            <span className="text-tea-text ml-2 text-xs font-sans uppercase tracking-wider block md:inline">{item.variant}</span>
                                        </td>
                                        <td className="p-4 text-xs text-tea-text hidden md:table-cell">{item.origin}</td>
                                        <td className="p-4 text-right font-mono text-xs text-tea-text">{item.stock_g}g</td>
                                        <td className="p-4 text-right font-mono text-xs text-tea-gold">${item.category === 'tea' ? item.price_per_gram : item.price_50g}</td>
                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => handleToggleVisibility(e, item.id)}
                                                    className={`p-2 transition-colors ${isHidden ? 'text-tea-text hover:text-white' : 'text-white hover:text-white'}`}
                                                    title={isHidden ? 'Show item (currently hidden)' : 'Hide item (currently visible)'}
                                                    aria-label={isHidden ? 'Show item' : 'Hide item'}
                                                >
                                                    {isHidden ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={(e) => handleInventoryDelete(e, item.id)}
                                                    className="p-2 hover:text-red-500 text-tea-text transition-colors"
                                                    title="Delete item"
                                                    aria-label={`Delete ${item.name}`}
                                                >
                                                    <Icons.Trash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                                {(inventoryTab === 'TEA' ? teaItems : wareItems).length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-tea-text-dim italic">No items found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- SETTINGS SECTION --- */}
            {section === 'SETTINGS' && (
                <div className="max-w-3xl mx-auto animate-[fadeIn_0.3s_ease-out]">
                    <h2 className="text-2xl font-serif text-tea-text mb-8">Admin Settings</h2>

                    {/* Theme Section */}
                    <div className="bg-tea-bg border border-tea-gold/10 rounded-sm p-6 mb-8">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-serif text-white mb-2">Theme</h3>
                                <p className="text-tea-text text-sm">Control the appearance of the entire application</p>
                            </div>
                            <ThemeSettings />
                        </div>
                    </div>

                    {/* Shopping Cart Section */}
                    <div className="bg-tea-bg border border-tea-gold/10 rounded-sm p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-serif text-white mb-2">Shopping Cart</h3>
                                <p className="text-tea-text text-sm">Manage your product selections and generate orders</p>
                            </div>
                            <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('openCart')); }} className="px-4 py-2 bg-tea-gold hover:bg-tea-gold/90 text-tea-paper text-xs uppercase tracking-[0.15em] rounded-sm transition-colors flex items-center gap-2">
                                <Icons.Bag className="w-4 h-4" />
                                View Cart
                            </a>
                        </div>
                    </div>
                </div>
            )}

        </div>
    </div>

    {/* Delete Confirmation Dialog */}
    <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title={deleteDialog.type === 'story' ? 'Delete Story' : deleteDialog.type === 'inventory' ? 'Delete Item' : 'Delete Page'}
        message={deleteDialog.type === 'story' && deleteDialog.item ? `Are you sure you want to delete "${(deleteDialog.item as Story).title}"? This action cannot be undone.` : deleteDialog.type === 'inventory' && deleteDialog.item ? `Are you sure you want to delete "${(deleteDialog.item as InventoryItem).name}"? This action cannot be undone.` : 'Are you sure you want to delete this page? This action cannot be undone.'}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, type: 'story' })}
        preview={deleteDialog.type === 'story' && deleteDialog.item ? (
            <div className="text-left">
                <p className="text-sm font-serif text-tea-text mb-1">{(deleteDialog.item as Story).title}</p>
                <p className="text-xs text-tea-text/70">{(deleteDialog.item as Story).subtitle}</p>
            </div>
        ) : deleteDialog.type === 'inventory' && deleteDialog.item ? (
            <div className="text-left">
                <p className="text-sm font-serif text-tea-text mb-1">{(deleteDialog.item as InventoryItem).name}</p>
                <p className="text-xs text-tea-text/70">{(deleteDialog.item as InventoryItem).variant} - {(deleteDialog.item as InventoryItem).stock_g}g</p>
            </div>
        ) : undefined}
    />
    </>
  );
};

// Theme Settings Component
const ThemeSettings = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="px-6 py-2 bg-tea-gold/10 hover:bg-tea-gold/15 border border-tea-gold/15 rounded-sm text-white text-xs uppercase tracking-[0.15em] flex items-center gap-2 transition-colors"
    >
      {theme === 'dark' ? (
        <>
          <Icons.Sun className="w-4 h-4" />
          Light Mode
        </>
      ) : (
        <>
          <Icons.Moon className="w-4 h-4" />
          Dark Mode
        </>
      )}
    </button>
  );
};
