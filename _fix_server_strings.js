/**
 * Fix Arabic string literals in server.js
 * Replace corrupted double-encoded strings with ASCII equivalents
 * 
 * Challenge: corrupted Arabic ل = D9 84 becomes Ù" (two chars including a literal ")
 * This means the string has internal " characters, so simple regex won't work.
 * 
 * Solution: for each known problematic line, replace from context-marker to end of string.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'cloud-server/server.js');
let content = fs.readFileSync(filePath, 'utf8');

let fixed = 0;

// Each entry: find the EXACT corrupted string by context and replace it
// Use a unique prefix + suffix to anchor the match, spanning over internal "
// Strategy: replace the WHOLE .json({ error: "...anything..." }) pattern on specific lines

// Helper: do a targeted search/replace on the raw content
function replaceOnLine(lineNum, searchFrom, searchTo, newContent) {
  const lines = content.split('\n');
  const line = lines[lineNum - 1];
  
  const fromIdx = line.indexOf(searchFrom);
  if (fromIdx === -1) {
    console.log(`L${lineNum}: marker "${searchFrom}" not found`);
    return false;
  }
  
  const toIdx = line.lastIndexOf(searchTo);
  if (toIdx === -1 || toIdx <= fromIdx) {
    console.log(`L${lineNum}: end marker "${searchTo}" not found`);
    return false;
  }
  
  const before = line.substring(0, fromIdx);
  const after = line.substring(toIdx + searchTo.length);
  const newLine = before + newContent + after;
  
  console.log(`L${lineNum} BEFORE: ${line.trim().substring(0, 80)}`);
  console.log(`L${lineNum} AFTER:  ${newLine.trim()}`);
  
  lines[lineNum - 1] = newLine;
  content = lines.join('\n');
  fixed++;
  return true;
}

// Fix each line: find "error: " prefix and end with '" });' or '",\n' etc.
replaceOnLine(1456, 'error: "', '"', `error: "Content not found"`);
replaceOnLine(1478, '"', '",',   `"This series has no episodes yet",`);
replaceOnLine(1594, 'error: "', '"', `error: "No stream link"`);
replaceOnLine(1624, 'error: "', '"', `error: "Stream init error"`);
replaceOnLine(1713, 'error: "', '"', `error: "Session not found"`);
replaceOnLine(1765, 'error: "', '"', `error: "Session not found"`);
replaceOnLine(1786, 'error: "', '"', `error: "Subtitles unavailable"`);
replaceOnLine(1792, 'error: "', '"', `error: "Subtitle extraction error"`);
replaceOnLine(2866, 'error: "', '"', `error: "tmdbId or imdbId required"`);
replaceOnLine(2922, 'ar: "',    '",', `ar: "Arabic",`);
replaceOnLine(2923, 'ara: "',   '",', `ara: "Arabic",`);
replaceOnLine(3304, 'error: "', '"', `error: "File not found"`);
replaceOnLine(3545, 'message: "', '",', `message: "Syncing channels...",`);
replaceOnLine(5179, 'error: "', '"', `error: "Internal error"`);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Fixed ${fixed} lines in server.js`);

// Quick syntax check
try {
  require('child_process').execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
  console.log('✅ Syntax check passed!');
} catch (e) {
  const msg = (e.stderr?.toString() || e.message || '');
  const match = msg.match(/:(\d+)/);
  console.log('❌ Syntax error at line ' + (match ? match[1] : '?'));
  console.log(msg.split('\n').slice(0, 4).join('\n'));
}

