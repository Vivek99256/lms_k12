import fs from 'fs';

const filePath = 'app/pal/learn/concept/[conceptId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "      recordStageProgression(conceptId, 'practice');",
  "      if (data?.attempt && data.attempt > 0) {\n        recordStageProgression(conceptId, `practice_${data.attempt + 1}`);\n      } else {\n        recordStageProgression(conceptId, 'practice');\n      }"
);

content = content.replace(
  "    if (conceptId) {\n      recordStageProgression(conceptId, 'learn');\n    }",
  "    if (conceptId) {\n      if (data?.attempt && data.attempt > 0) {\n        recordStageProgression(conceptId, `learn_${data.attempt + 1}`);\n      } else {\n        recordStageProgression(conceptId, 'learn');\n      }\n    }"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated learn revisit progression');

