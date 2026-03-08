import { Story, ContentType, LayoutVariant } from '../../types';

export interface PageState { id: string; variant: LayoutVariant; content: string; images: string[]; textColor?: 'light' | 'dark'; }

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const DEFAULT_STORY: Story = {
  id: '', type: ContentType.Article, status: 'draft', title: 'Untitled', subtitle: 'Subtitle', thumbnailUrl: 'https://picsum.photos/600/800', durationOrTime: '5 min', origin: 'In-house', description: '...', content: [], drawings: false
};

export const parsePagesFromStory = (story: Story): PageState[] => {
    if (!story.content || story.content.length === 0) return [];
    return story.content.map(block => {
        const variantMatch = block.match(/^:::(\w+):::(.*)/s);
        let variant = LayoutVariant.TEXT_SINGLE_COL;
        let rawContent = block;
        if (variantMatch) {
            if (Object.values(LayoutVariant).includes(variantMatch[1] as LayoutVariant)) variant = variantMatch[1] as LayoutVariant;
            rawContent = variantMatch[2] || '';
        }
        let textColor: 'light' | 'dark' = 'light';
        if (rawContent.startsWith('$$dark$$')) { textColor = 'dark'; rawContent = rawContent.substring(8); }
        const parts = rawContent.split('|');
        const isUrl = (s: string) => s && (s.match(/^https?:\/\//) || s.startsWith('data:image') || s.includes('picsum'));
        const images = parts.filter(isUrl);
        const textContent = parts.filter(p => !isUrl(p)).join('|');
        return { id: generateId(), variant, content: textContent, images, textColor };
    });
};

export const serializePagesToContent = (pages: PageState[]): string[] => {
    return pages.map(p => {
        let blockContent = p.content;
        if (p.textColor === 'dark') blockContent = '$$dark$$' + blockContent;
        if (p.images && p.images.length > 0) blockContent += '|' + p.images.join('|');
        return `:::${p.variant}:::${blockContent}`;
    });
};
