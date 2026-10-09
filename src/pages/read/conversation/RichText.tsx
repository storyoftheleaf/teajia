/**
 * Words from a conversation spec, drawn with their small markup and editable
 * on the page by the owner.
 *
 * Reading: `_words_` is emphasis, `==words==` is the bronze highlight, and
 * Chinese characters are marked as Chinese so a screen reader says them in
 * Chinese and the Chinese face is used. Editing: the owner sees and edits
 * the raw text, markers included, exactly as it is stored.
 */
import React from 'react';
import { EditableText, useStoryEdit } from '../storyEdit';
import { TermLink, glossaryIndex, useGlossaryFieldTermIds } from '../../../components/reader/GlossaryTerms';
import { linkSelectedTermsInTree } from '../../../lib/glossaryTerms';

const HAN = /([㐀-鿿豈-﫿]+)/;

function withChinese(text: string, key: string): React.ReactNode[] {
  return text.split(HAN).map((part, i) =>
    HAN.test(part)
      ? <span key={`${key}-${i}`} lang="zh-Hans" className="tj-conv-cn">{part}</span>
      : part,
  );
}

/** Parse the markup into nodes. Exported for the tests. An opening quote mark
 *  hangs outside the text edge, so the words themselves line up. */
export function renderMarkup(text: string): React.ReactNode[] {
  if (text.startsWith('“')) return [<span key="hang" className="tj-conv-hang">“</span>, ...renderMarkup(text.slice(1))];
  return text.split(/(==[^=]+==|_[^_]+_)/).flatMap((seg, i): React.ReactNode[] => {
    if (seg.startsWith('==') && seg.endsWith('==') && seg.length > 4) {
      return [<span key={i} className="tj-conv-gold">{withChinese(seg.slice(2, -2), `g${i}`)}</span>];
    }
    if (seg.startsWith('_') && seg.endsWith('_') && seg.length > 2) {
      return [<em key={i} className="tj-conv-em">{withChinese(seg.slice(1, -1), `e${i}`)}</em>];
    }
    return withChinese(seg, `t${i}`);
  });
}

export const Rich: React.FC<{
  field: string;
  text: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
}> = ({ field, text, as = 'p', className, style, multiline = true }) => {
  const { isOwner, editing, previewVisitor, text: stored } = useStoryEdit();
  const termIds = useGlossaryFieldTermIds(field);
  if (isOwner && editing && !previewVisitor) {
    return <EditableText field={field} as={as} className={className} style={style} multiline={multiline}>{text}</EditableText>;
  }
  const Tag = as as React.ElementType;
  const content = renderMarkup(stored(field, text));
  const linked = termIds
    ? linkSelectedTermsInTree(content, glossaryIndex(), termIds, (termId, termText, key) => (
      <TermLink key={key} termId={termId}>{termText}</TermLink>
    ))
    : content;
  return <Tag className={className} style={style}>{linked}</Tag>;
};
