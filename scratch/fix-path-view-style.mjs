import fs from 'fs';

const filePath = 'app/pal/journey/_components/path/PathJourneyView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldStyle = `      <style jsx>{\`
        .node-pop-in {
          animation: nodePopIn 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .node-fade-in {
          animation: nodeFadeIn 420ms ease both;
        }
        @keyframes nodePopIn {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes nodeFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      \`}</style>`;

const newStyle = `      <style dangerouslySetInnerHTML={{
        __html: \`
        .node-pop-in {
          animation: nodePopIn 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .node-fade-in {
          animation: nodeFadeIn 420ms ease both;
        }
        @keyframes nodePopIn {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes nodeFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      \`,
      }} />`;

content = content.replace(oldStyle, newStyle);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed style in PathJourneyView');

