import fs from 'fs';

const filePath = 'app/pal/adaptive/concept/[conceptId]/result/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { AnswerReviewButton } from '@/app/pal/_components/AnswerReview';",
    "import { AnswerReviewButton } from '@/app/pal/_components/AnswerReview';\nimport { recordStageProgression } from '@/app/pal/data/pal-progression';"
  );
}

if (!content.includes("recordStageProgression(conceptId, 'plan')")) {
  content = content.replace(
    "      fetchConceptResult(conceptId, controller.signal)\n        .then(setResult)",
    "      fetchConceptResult(conceptId, controller.signal)\n        .then((res) => {\n          setResult(res);\n          if (res && res.attempted > 0) {\n            recordStageProgression(conceptId, 'plan');\n          }\n        })"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated concept result page');

