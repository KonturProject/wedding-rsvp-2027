import fs from 'node:fs/promises';
const html=await fs.readFile('docs/demo.html','utf8'),css=await fs.readFile('docs/style.css','utf8'),js=await fs.readFile('docs/demo-client.js','utf8');
await fs.writeFile('apps-script/App.html',html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`).replace('<script src="demo-client.js" defer></script>',`<script>window.APP_BOOT = <?!= boot ?>;</script>`).replace('</body>',`<script>${js}</script></body>`));
await fs.writeFile('docs/admin.html', (await fs.readFile('docs/index.html','utf8')).replace('<title>Наша свадьба · июль 2027</title>','<title>Админка · Наша свадьба</title>'));
console.log('Apps Script HTML and admin entry generated');
