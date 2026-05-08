/**
 * Fix double-encoded UTF-8 corruption in server.js
 * 
 * Problem: Arabic text in string literals got double-encoded.
 * Arabic ل (Lam, U+0644, UTF-8: D9 84) got corrupted to Ù" (C3 99 + 22)
 * This causes SyntaxError because " prematurely closes the string.
 * 
 * Fix: Replace all Arabic string content in JS string literals with English equivalents.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'cloud-server/server.js');
let content = fs.readFileSync(filePath, 'utf8');

// Map of corrupted Arabic strings → their English replacements
// We find these by looking for patterns with Ù" inside string literals
// The pattern 'Ù"' is the corrupted Arabic ل (Lam)

// Strategy: do a full decode of double-encoded UTF-8
// For chars in range 0x80-0xFF that came from Arabic bytes:
// Buffer.from(char, 'latin1') gives the original byte
// Exception: 0x84 was corrupted to 0x22 (ASCII ") - we can't recover these

// Simple approach: re-encode via latin1
function fixDoubleEncoding(str) {
  // Each char in the corrupted string: if it's > U+0100, convert to bytes via latin1
  // then re-decode the resulting bytes as UTF-8
  // But we need to be careful about the 0x22 corruption
  
  // Convert string chars to bytes using latin1 interpretation
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x100) {
      bytes.push(code);
    } else {
      // For chars > U+00FF, push each UTF-8 byte
      const charBuf = Buffer.from(str[i], 'utf8');
      for (const b of charBuf) bytes.push(b);
    }
  }
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return str;
  }
}

// Find all string literals (double-quoted) that contain corrupted Arabic (Ù")
// and report them
const lines = content.split('\n');
let problemLines = [];

lines.forEach((line, i) => {
  const trimmed = line.trim();
  // Skip pure comment lines
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
  
  // Check for corrupted Lam inside string literals
  if (line.includes('Ù"') || line.includes("Ù'")) {
    problemLines.push({ num: i + 1, line: line.trim().substring(0, 120) });
  }
});

console.log(`Found ${problemLines.length} problematic lines:`);
problemLines.forEach(({ num, line }) => {
  console.log(`  L${num}: ${line}`);
});

// Now fix: replace the double-encoded characters back to proper UTF-8
// using a targeted approach - convert line by line only for non-comment lines
let fixedLines = lines.map((line, i) => {
  const trimmed = line.trim();
  // Pure comment lines: leave as-is
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return line;
  
  if (!line.includes('Ù"') && !line.includes("Ù'")) return line;
  
  // This line has corrupted Arabic in a non-comment context
  // Try to fix the double-encoding
  const fixed = fixDoubleEncoding(line);
  console.log(`\nFixed L${i+1}:`);
  console.log(`  BEFORE: ${line.trim().substring(0, 100)}`);
  console.log(`  AFTER:  ${fixed.trim().substring(0, 100)}`);
  return fixed;
});

const fixedContent = fixedLines.join('\n');

// Write backup
fs.writeFileSync(filePath + '.backup', content);
// Write fixed
fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log('\n✅ Fixed server.js written. Backup at server.js.backup');

// Verify the fix worked by checking line 1456
const verifyLines = fixedContent.split('\n');
console.log('\nVerify line 1456:', JSON.stringify(verifyLines[1455].trim().substring(0, 80)));
