const fs = require('fs');
const filePath = 'app/general/_components/TemplateHtmlEditor.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the last occurrence of the pattern
const marker = '</iframe></div></div>}\n';
const idx = content.lastIndexOf(marker);
if (idx === -1) {
  // Try with \r\n
  const marker2 = '</iframe></div></div>}\r\n';
  const idx2 = content.lastIndexOf(marker2);
  if (idx2 === -1) {
    console.log('Marker not found at all');
    // Show what's around the last iframe
    const lastIdx = content.lastIndexOf('</iframe>');
    console.log('Around last iframe:', JSON.stringify(content.substring(lastIdx)));
  } else {
    // Found with \r\n
    const before = content.substring(0, idx2 + marker2.length);
    const after = content.substring(idx2 + marker2.length);
    console.log('After marker:', JSON.stringify(after));
    const newContent = before + '\r\n   {!disabled&&<div className="h-1 cursor-ns-resize bg-slate-300 hover:bg-slate-400" onMouseDown={startHeightResize} title="Drag to resize editor height"/>}\r\n' + after;
    fs.writeFileSync(filePath, newContent);
    console.log('Replaced with \\r\\n');
  }
} else {
  const before = content.substring(0, idx + marker.length);
  const after = content.substring(idx + marker.length);
  console.log('After marker:', JSON.stringify(after));
  const newContent = before + '\n   {!disabled&&<div className="h-1 cursor-ns-resize bg-slate-300 hover:bg-slate-400" onMouseDown={startHeightResize} title="Drag to resize editor height"/>}\n' + after;
  fs.writeFileSync(filePath, newContent);
  console.log('Replaced with \\n');
}
