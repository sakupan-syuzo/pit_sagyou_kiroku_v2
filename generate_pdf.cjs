const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const htmlPath = 'C:/Users/davef/.gemini/antigravity/brain/e16b34d5-f75c-4660-a0c1-58b92e69d700/PitRec_User_Guide.html';
    const pdfPath = 'C:/Users/davef/.gemini/antigravity/brain/e16b34d5-f75c-4660-a0c1-58b92e69d700/PitRec_User_Guide.pdf';
    
    const content = fs.readFileSync(htmlPath, 'utf8');
    await page.setContent(content, { waitUntil: 'networkidle0' });
    await page.pdf({ 
        path: pdfPath, 
        format: 'A4',
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        printBackground: true
    });
    
    await browser.close();
    console.log('PDF generated successfully');
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
