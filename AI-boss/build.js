const fs = require('fs');
const path = require('path');

const files = [
  '00-header.js',
  '01-config.js',
  '02-state.js',
  '03-utils.js',
  '04-storage.js',
  '05-hr-interaction.js',
  '06-ui-core.js',
  '07-settings.js',
  '08-core.js',
  '09-conversation.js',
  '10-process.js',
  '11-extras.js',
  '13-desktop-bridge.js',
  '12-footer.js',
];

const outPath = path.join(__dirname, '..', 'Boss_helper.js');

let output = '';
for (const file of files) {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  output += content.trimEnd() + '\n';
}

fs.writeFileSync(outPath, output, 'utf8');
const stats = fs.statSync(outPath);
console.log(`Built Boss_helper.js (${output.split('\n').length} lines, ${(stats.size / 1024).toFixed(1)} KB)`);
