// The judge's prompt and how its answer is read (judge.mjs). Pure.

/** The one prompt for one review item. `note` is the vault research note for a claim's page, or null. */
export function judgePrompt(item, rules, note) {
  const body = item.kind === 'claim'
    ? `A section of the Wisdom page "${item.groupLabel}" (${item.groupMeta}).
Heading: ${item.label}
Proposed text: ${item.text}
${item.before ? `Text live on the site now (this is an edit of it): ${item.before}\n` : ''}What it is meant to cover: ${item.scope}
Sources cited: ${item.sources.length ? item.sources.map(source => source.title || source.publisher).join('; ') : 'none (trade knowledge, written in our own words)'}

The research note behind the page${note ? ':\n<research-note>\n' + note.slice(0, 20000) + '\n</research-note>' : ' is missing.'}`
    : `A composed Tea Wisdom entry for the tea "${item.groupLabel}" (${item.groupMeta}).
${item.paragraphs.map((text, index) => `Paragraph ${index + 1}: ${text}`).join('\n')}
Links like [words](page:section) point to approved Wisdom sections; the checker has already confirmed every sentence rests on them or on the tea's record.`;

  return `You approve Tea Wisdom writing for Teajia, a specialist tea shop, in place of its owner Adrian. He has said he should not have to approve every item himself. He writes his standards down; you apply them. What you approve goes on the public site after his push. What needs work goes back to an agent; only what truly needs him comes to him, with your reason.

Approve only when all of these hold:
1. Nothing is invented. Every specific (a date, a number, a name, a place, a claim about how something is made) is the kind the trade commonly agrees on and, for a page section, is supported in the research note's "What is commonly agreed" list. A section with no research note may be approved only if it states nothing more specific than common tea-trade knowledge.
2. It follows every rule in his page rules below, and the house voice.
3. For an edit of live text: the new text is at least as good and as true as the live text.
4. Type, grade, place and maker are kept apart: nothing about one is said as if it were true of another.

When it fails, choose which of two kinds of hold it is:
- "rework": the fix is work an agent can do without Adrian: a fact needs research or a research note is missing, a rule is broken, the text is internal notes rather than writing for a reader, an unsupported sentence must be cut. It goes straight back to a research or writing agent with your reason; Adrian never sees it.
- "ask": only Adrian can settle it: a question of taste or direction his rules do not answer, a choice between two true framings, whether a page should exist at all.
Prefer "rework" whenever an agent could fix it. Approving a wrong fact puts it in front of customers, so never approve when unsure. Do not hold for small matters of taste that his rules do not cover.

<page-rules>
${rules.pages}
</page-rules>

<house-voice>
${rules.voice}
</house-voice>

The item:
${body}

Reply with one JSON object and nothing else: {"choice": "approve" | "rework" | "ask", "reason": "<one plain sentence Adrian can read: why, naming the rule or fact>", "fix": "<for rework: what the agent should do, one sentence; otherwise empty>"}`;
}

const CHOICES = new Set(['approve', 'rework', 'ask']);

/** The judge's verdict. Anything unreadable is a question for Adrian, never an approval. */
export function parseVerdict(text) {
  const start = text.indexOf('{');
  for (let end = text.lastIndexOf('}'); start >= 0 && end > start; end = text.lastIndexOf('}', end - 1)) {
    try {
      const value = JSON.parse(text.slice(start, end + 1));
      if (value && CHOICES.has(value.choice)) {
        return {
          choice: value.choice,
          reason: typeof value.reason === 'string' && value.reason.trim() ? value.reason.trim() : 'No reason given.',
          ...(value.choice === 'rework' && typeof value.fix === 'string' && value.fix.trim() ? { fix: value.fix.trim() } : {}),
        };
      }
      break;
    } catch { /* keep shrinking */ }
  }
  return { choice: 'ask', reason: 'The judge gave no readable answer.' };
}
