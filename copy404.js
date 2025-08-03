// copy404.js
import fs from 'fs';
import path from 'path';

const indexPath = path.join('dist', 'index.html');
const errorPath = path.join('dist', '404.html');

fs.copyFile(indexPath, errorPath, (err) => {
  if (err) {
    console.error('❌ Failed to copy index.html to 404.html:', err);
    process.exit(1);
  } else {
    console.log('✅ 404.html created successfully!');
  }
});
