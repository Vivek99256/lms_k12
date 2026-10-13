import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { glyphOf } from './glyph';

describe('glyphOf', () => {
  it('picks the icon for the idea a text is about', () => {
    assert.equal(glyphOf('Describe how cells are studied with a microscope'), 'microscope');
    assert.equal(glyphOf('Explain osmosis and diffusion across the membrane'), 'water');
    assert.equal(glyphOf('Name the selectively permeable cell membrane'), 'membrane');
    assert.equal(glyphOf('Compare mitosis and meiosis'), 'division');
    assert.equal(glyphOf('The nucleus holds the DNA'), 'nucleus');
    assert.equal(glyphOf('State the cell theory'), 'history');
    assert.equal(glyphOf('Mitochondria release energy'), 'energy');
    assert.equal(glyphOf('Explain how cell growth is regulated'), 'growth');
  });

  it('puts the more specific idea first', () => {
    // "mitosis" and "membrane" in one line: the division idea wins over the membrane one.
    assert.equal(glyphOf('Mitosis and the cell membrane'), 'division');
  });

  it('falls back to a neutral icon', () => {
    assert.equal(glyphOf('Something else entirely'), 'target');
    assert.equal(glyphOf(''), 'target');
  });
});
