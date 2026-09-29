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

const HAN = /([㐀-鿿豈-﫿]+)/;

function withChinese(text: string, key: string): React.ReactNode[] {
  return text.split(HAN).map((part, i) =>
    HAN.test(part)
      ? <span key={`${key}-${i}`} lang="zh-Hans" className="tj-conv-cn">{part}</span>
      : part,
  );
}

/** Parse the markup into nodes. Exported for the tests. */
export function renderMarkup(text: string): React.ReactNode[] {
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
  if (isOwner && editing && !previewVisitor) {
    return <EditableText field={field} as={as} className={className} style={style} multiline={multiline}>{text}</EditableText>;
  }
  const Tag = as as React.ElementType;
  return <Tag className={className} style={style}>{renderMarkup(stored(field, text))}</Tag>;
};
