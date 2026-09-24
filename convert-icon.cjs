const sharp = require('sharp');
const path = require('path');

async function convertIcon() {
  const src = path.join(__dirname, 'public', 'pwa-512.jpg');
  
  await sharp(src)
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, 'public', 'pwa-512.png'));
  
  await sharp(src)
    .resize(192, 192)
    .png()
    .toFile(path.join(__dirname, 'public', 'pwa-192.png'));
  
  await sharp(src)
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, 'public', 'apple-touch-icon.png'));

  console.log('Icons generated successfully');
}

convertIcon().catch(console.error);
