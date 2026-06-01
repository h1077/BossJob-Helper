const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('../Boss_helper.js', 'utf8');
const lines = src.split('\n');

const parts = [
  { file: '00-header.js',       start: 1,    end: 66    },  // UserScript + IIFE start + typedefs
  { file: '01-config.js',       start: 67,   end: 159   },  // CONFIG, getStoredJSON, setLargeItem
  { file: '02-state.js',        start: 160,  end: 239   },  // state, elements
  { file: '03-utils.js',        start: 240,  end: 435   },  // ErrorHandler, DOMCache, ManagedSet, EventManager, DOMUtils
  { file: '04-storage.js',      start: 436,  end: 588   },  // StorageManager, StatePersistence
  { file: '05-hr-interaction.js',start: 589, end: 1116  },  // HRInteractionManager
  { file: '06-ui-core.js',      start: 1117, end: 1936  },  // UI object (panel, miniIcon)
  { file: '07-settings.js',     start: 1937, end: 4280  },  // settings, dialogs, helper functions
  { file: '08-core.js',         start: 4281, end: 6343  },  // Core (main logic + AI + file parsing)
  { file: '09-conversation.js', start: 6344, end: 6458  },  // PHASES, STRATEGIES, detectPhase, buildPrompt
  { file: '10-process.js',      start: 6459, end: 6553  },  // toggleProcess, toggleChatProcess
  { file: '11-extras.js',       start: 6554, end: 7172  },  // letter, guide, styles
  { file: '12-footer.js',       start: 7173, end: lines.length }, // init, helpers, IIFE close
];

const outDir = __dirname;
let total = 0;
for (const part of parts) {
  const content = lines.slice(part.start - 1, part.end).join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, part.file), content, 'utf8');
  const len = part.end - part.start + 1;
  total += len;
  console.log(`${part.file}: lines ${part.start}-${part.end} (${len} lines)`);
}

console.log(`\nTotal: ${total} lines (original: ${lines.length})`);
console.log('Split complete.');
