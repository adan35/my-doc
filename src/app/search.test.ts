import { describe, expect, it } from 'vitest';
import { findFirstMatch, markdownToPlainText } from './search';

describe('search snippets', () => {
  it('strip Markdown syntax but keep the words', () => {
    const plain = markdownToPlainText(
      [
        '---',
        'tags: [exam]',
        '---',
        '# Heading **bold**',
        '> quote with [a link](./a.md), [[Note#Part|an alias]] and ![a picture](x.png)',
        '- [ ] task _em_ snake_case *star* `code`',
        '| a | b |',
        '| --- | --- |',
        '```js',
        'const RATE_LIMIT = 1;',
        '```',
      ].join('\n'),
    );
    expect(plain.split('\n')).toEqual([
      'Heading bold',
      'quote with a link, an alias and a picture',
      'task em snake_case star code',
      'a · b',
      'const RATE_LIMIT = 1;',
    ]);
  });

  it('find the first match, preferring the longest term, ignoring case', () => {
    expect(findFirstMatch('Alpha BETAMAX beta', ['beta', 'betamax'])).toEqual({
      from: 6,
      to: 13,
    });
    expect(findFirstMatch('nothing here', ['zebra'])).toBeNull();
  });
});
