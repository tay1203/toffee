const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(() => {
  const source = nativeImage.createFromPath(path.resolve('public/assets/app-icon.png'));
  if (source.isEmpty()) throw new Error('Missing app icon');
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = sizes.map(size => source.resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const start = 6 + i * 16;
    header[start] = size === 256 ? 0 : size; header[start + 1] = header[start];
    header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(images[i].length, start + 8); header.writeUInt32LE(offset, start + 12);
    offset += images[i].length;
  });
  fs.writeFileSync('public/assets/app-icon.ico', Buffer.concat([header, ...images]));
  console.log('Created Windows icon with 6 sizes.'); app.quit();
}).catch(error => { console.error(error); app.exit(1); });
