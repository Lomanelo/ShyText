const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const pub = path.join(__dirname, '..', 'public');
fs.mkdirSync(dist, { recursive: true });
for (const file of ['privacy.html', 'terms.html']) {
  fs.copyFileSync(path.join(pub, file), path.join(dist, file));
}
