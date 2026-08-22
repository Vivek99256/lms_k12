const asText = (v) => (v === null || v === undefined) ? '' : String(v).trim();
function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string') {
    try { const p = JSON.parse(value); if (Array.isArray(p)) return p; return (p === null || p === undefined) ? [] : [p]; }
    catch { return [value]; }
  }
  return [value];
}
function asTextList(value, key) {
  return asArray(value).map((item) =>
    item && typeof item === 'object' ? asText(item[key]) : asText(item)
  ).filter(Boolean);
}
const cases = [
  ['array of objects', [{knowledge:'A'},{knowledge:'B'}]],
  ['single object (the crash)', {knowledge:'Photosynthesis'}],
  ['array of strings', ['A','B']],
  ['plain string', 'Photosynthesis'],
  ['JSON string array', '[{"knowledge":"A"}]'],
  ['null', null],
  ['undefined', undefined],
  ['empty string', ''],
  ['number', 42],
  ['empty array', []],
];
for (const [name, v] of cases) console.log(name.padEnd(26), '->', JSON.stringify(asTextList(v,'knowledge')));
