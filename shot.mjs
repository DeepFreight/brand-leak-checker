import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
await p.goto('http://localhost:3100'); await p.fill('input[placeholder="e.g. Ocean Bottle"]','Ocean Bottle');
await p.fill('input[placeholder="yourbrand.com"]','https://oceanbottle.co'); await p.fill('input[type=email]','test@example.com');
await p.screenshot({ path: 'screenshots/form.png', fullPage: true });
await p.click('button.btn'); await p.waitForSelector('.banner'); await p.screenshot({ path: 'screenshots/results.png', fullPage: true });
await b.close();
