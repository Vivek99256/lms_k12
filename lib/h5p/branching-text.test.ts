import test from 'node:test';
import assert from 'node:assert/strict';

import { roundTrips, toHtml, toPlain } from './branching-text';

/**
 * The editor shows a screen's HTML as plain text. What matters is that it never
 * loses what a teacher or the generator wrote: HTML it cannot show as text is
 * reported as such, so the editor offers the HTML instead of flattening it.
 */

test('paragraphs, bullets and numbered steps become the HTML they stand for', () => {
  assert.equal(toHtml('One idea.\n\nAnother idea.'), '<p>One idea.</p><p>Another idea.</p>');
  assert.equal(toHtml('- first\n- second'), '<ul><li>first</li><li>second</li></ul>');
  assert.equal(toHtml('1. open\n2) close'), '<ol><li>open</li><li>close</li></ol>');
  assert.equal(toHtml('line one\nline two'), '<p>line one<br>line two</p>');
});

test('bold and italic work inside a line, and nothing a teacher types is read as markup', () => {
  assert.equal(toHtml('a **strong** and *soft* word'), '<p>a <strong>strong</strong> and <em>soft</em> word</p>');
  assert.equal(toHtml('5 < 7 & <script>x</script>'), '<p>5 &lt; 7 &amp; &lt;script&gt;x&lt;/script&gt;</p>');
});

test('empty in, empty out', () => {
  assert.equal(toHtml('   '), '');
  assert.equal(toPlain(''), '');
});

test('the generator\'s HTML reads back as text', () => {
  const html = '<p>A model keeps <strong>only</strong> what the question needs.</p><ul><li>Measure first</li><li>Say why</li></ul>';

  assert.equal(toPlain(html), 'A model keeps **only** what the question needs.\n\n- Measure first\n- Say why');
  assert.equal(roundTrips(html), true);
});

test('what is written is what comes back after a trip through the text editor', () => {
  for (const html of [
    '<p>One.</p>',
    '<p>One.</p><p>Two <em>soft</em>.</p>',
    '<ol><li>open</li><li>close</li></ol>',
    '<p>line one<br>line two</p>',
    '<p>5 &lt; 7 &amp; 8 &gt; 2</p>',
  ]) {
    assert.equal(roundTrips(html), true, html);
    assert.equal(toHtml(toPlain(html) as string), html);
  }
});

test('HTML the text grammar cannot say is reported, never flattened', () => {
  for (const html of [
    '<p>H<sub>2</sub>O is water.</p>',
    '<table><tr><td>x</td></tr></table>',
    '<p>See <a href="https://example.org">this</a>.</p>',
    '<h3>A heading</h3><p>Words.</p>',
    'Loose text with no block around it.',
    '<ul><li>one<br>two</li></ul>',
  ]) {
    assert.equal(toPlain(html), null, html);
    assert.equal(roundTrips(html), false, html);
  }
});

test('bold and italic written with b and i are the same thing as strong and em', () => {
  assert.equal(roundTrips('<p>a <b>b</b> and <i>i</i></p>'), true);
});

test('a literal asterisk would turn into italics, so that HTML is shown as HTML', () => {
  assert.equal(roundTrips('<p>2 * 3 * 4 = 24</p>'), false);
});
