import fs from 'fs';

const filePath = 'app/pal/eso/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldCheckSubmit = `      onResolved(
        await submitCheckUnderstanding(
          learnerId,
          action.nodeId,
          conceptId,
          loaded.map((item) => ({ answerMasterId: answers[item.questionId] }))
        )
      );`;

const newCheckSubmit = `      const checkOutcome = await submitCheckUnderstanding(
        learnerId,
        action.nodeId,
        conceptId,
        loaded.map((item) => ({ answerMasterId: answers[item.questionId] }))
      );
      if (conceptId) {
        if (checkOutcome.action === 'understood' || checkOutcome.action === 'mastery' || checkOutcome.action !== 'reteach') {
          // Check completed and passed -> Check turns green, Mastery becomes active!
          recordStageProgression(conceptId, 'mastery');
        } else {
          // Check failed -> Loop back to Support / Learn #2
          recordStageProgression(conceptId, 'support_1');
        }
      }
      onResolved(checkOutcome);`;

content = content.replace(oldCheckSubmit, newCheckSubmit);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated Check submission progression in eso/page.tsx');

