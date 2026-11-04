import fs from 'fs';

const filePath = 'app/pal/journey/data/pal-journey.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add isProgCompleted to line 1530
content = content.replace(
  '  const isProgMastery = isStageReachedOrPassed(focusConceptId, \'mastery\');\n\n  const hasConceptDiagAttempted',
  '  const isProgMastery = isStageReachedOrPassed(focusConceptId, \'mastery\');\n  const isProgCompleted = isStageReachedOrPassed(focusConceptId, \'completed\');\n\n  const hasConceptDiagAttempted'
);

// 2. Add hasPracticeAttempted to line 1660
content = content.replace(
  '  const isPracticeStuck = !hasPracticeCompleted && practiceResponses > 0 && practiceAccuracy != null && practiceAccuracy < 50;',
  '  const hasPracticeAttempted = hasLearnCompleted && (isAtLeastCheck || practiceResponses > 0);\n  const isPracticeStuck = !hasPracticeCompleted && practiceResponses > 0 && practiceAccuracy != null && practiceAccuracy < 50;'
);

// 3. Add hasCheckAttempted to line 1745
content = content.replace(
  '  const hasCheckCompleted = hasPracticeCompleted && (isAtLeastMastery || firstCfuPassed);',
  '  const hasCheckAttempted = hasPracticeCompleted && (isAtLeastMastery || cfuEntries.length > 0);\n  const hasCheckCompleted = hasPracticeCompleted && (isAtLeastMastery || firstCfuPassed);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed variable declarations in pal-journey.ts');

