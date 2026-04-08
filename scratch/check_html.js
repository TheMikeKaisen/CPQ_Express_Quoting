const fs = require('fs');
const content = fs.readFileSync('force-app/main/default/lwc/provusDashboard/provusDashboard.html', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    const matches = line.match(/\s[a-zA-Z0-9-]+=/g);
    if (matches) {
        const attrs = matches.map(m => m.trim().replace('=', ''));
        const seen = new Set();
        attrs.forEach(attr => {
            if (seen.has(attr)) {
                console.log(`Duplicate attribute "${attr}" on line ${index + 1}: ${line}`);
            }
            seen.add(attr);
        });
    }
});
