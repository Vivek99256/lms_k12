import assert from 'node:assert/strict';
import test from 'node:test';

import { examHelpPayload, examPaperIdFromPath, setExamHelpFocus } from './exam-help';

test('only a paper\'s attempt screen counts, never its result screen', () => {
  assert.equal(examPaperIdFromPath('/exam/online/2503'), '2503');
  assert.equal(examPaperIdFromPath('/exam/online/2503/'), '2503');
  assert.equal(examPaperIdFromPath('/exam/online/2503/result'), null);
  assert.equal(examPaperIdFromPath('/exam/online'), null);
  assert.equal(examPaperIdFromPath('/fees/collect'), null);
});

test('the payload is the focused question and only on that paper\'s screen', () => {
  setExamHelpFocus(null);
  assert.equal(examHelpPayload('/exam/online/2503'), undefined);

  setExamHelpFocus({ paperId: '2503', questionId: '89245' });
  assert.deepEqual(examHelpPayload('/exam/online/2503'), { paper_id: 2503, question_id: 89245 });
  assert.equal(examHelpPayload('/exam/online/4193'), undefined);
  assert.equal(examHelpPayload('/exam/online/2503/result'), undefined);

  setExamHelpFocus({ paperId: '2503', questionId: 'abc' });
  assert.equal(examHelpPayload('/exam/online/2503'), undefined);
  setExamHelpFocus(null);
});
