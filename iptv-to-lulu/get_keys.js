const d = require('/root/lulu_progress.json');
const keys = Object.keys(d.uploaded).slice(0, 5);
const vals = keys.map(k => ({ key: k, fileCode: d.uploaded[k].fileCode, title: d.uploaded[k].title }));
console.log(JSON.stringify(vals, null, 2));
