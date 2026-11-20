import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDraft, memoryOf, storyToDraft } from '../src/pages/read/conversation/magSend.ts';

// Invented content only. These tests never inspect a vault or contact an API.
const draft = `%%pull: hook%%
> "Clay remembers **the hand.**"

I arrived while the kiln was warm.

## At the bench

%%pull: xl follow%%
> "The bowl holds the light."

"And the glaze holds the colour."

%%on-photo: bowl.jpg · A bowl · aspect=4/5 ink=#111111 accent=#ffffff%%
> "Look at the rim."

%%ending%%

"That is all."

%%saying%%
> "Make it slowly."

I left with an empty cup.`;

const separated = (gap = '\n\n') => draft.replace(/(%%(?:pull:[^\n]+|on-photo:[^\n]+|saying)%%)\n>/g, `$1${gap}>`);

for (const gap of ['\n\n', '\n \t\n\n']) {
  test(`blank-line-separated quote markers preserve the story (${JSON.stringify(gap)})`, () => {
    const previous = parseDraft(draft);
    assert.deepEqual(parseDraft(separated(gap), memoryOf(previous)), previous);
  });
}

test('the contiguous format round trips with its keys and words intact', () => {
  const story = parseDraft(draft);
  assert.deepEqual(parseDraft(storyToDraft(story), memoryOf(story)), story);
});

for (const [name, quote, error] of [
  ['unquoted words', '> Clay remembers.', /must sit in quotation marks/],
  ['unapproved connecting words', '> "==Clay remembers.=="', /not approved yet/],
  ['an em dash', '> "Clay remembers — always."', /em dash/],
  ['a missing quote before a heading', '## Another part', /must sit in quotation marks/],
  ['a plain paragraph in place of a blockquote', '"Clay remembers."', /must sit in quotation marks/],
]) {
  test(`separated markers still refuse ${name}`, () => {
    assert.throws(() => parseDraft(separated().replace('> "Clay remembers **the hand.**"', quote)), error);
  });
}

test('a separated marker does not skip a note to find a later quote', () => {
  const body = separated().replace('> "Clay remembers **the hand.**"', '%%A writer note.%%\n\n> "Clay remembers."');
  assert.throws(() => parseDraft(body), /must sit in quotation marks/);
});

test('an unclosed side is still refused', () => {
  assert.throws(() => parseDraft(draft.replace('"That is all."', '%%side: cup.jpg · A cup%%\n\n"That is all."')), /never closed/);
});
