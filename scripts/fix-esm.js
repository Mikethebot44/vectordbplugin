import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Move ESM build from dist-esm to dist with .mjs extension
const distEsmDir = path.join(__dirname, '../dist-esm');
const distDir = path.join(__dirname, '../dist');

if (fs.existsSync(distEsmDir)) {
  const files = fs.readdirSync(distEsmDir);
  
  files.forEach(file => {
    if (file.endsWith('.js')) {
      const srcPath = path.join(distEsmDir, file);
      const destPath = path.join(distDir, file.replace('.js', '.mjs'));
      
      // Copy file content
      const content = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(destPath, content);
      
      console.log(`Created ${destPath}`);
    }
    
    if (file.endsWith('.js.map')) {
      const srcPath = path.join(distEsmDir, file);
      const destPath = path.join(distDir, file.replace('.js.map', '.mjs.map'));
      
      // Copy and update source map
      const content = fs.readFileSync(srcPath, 'utf8');
      const updatedContent = content.replace('"file":"index.js"', '"file":"index.mjs"');
      fs.writeFileSync(destPath, updatedContent);
      
      console.log(`Created ${destPath}`);
    }
  });
  
  // Clean up dist-esm directory
  fs.rmSync(distEsmDir, { recursive: true, force: true });
  console.log('Cleaned up dist-esm directory');
} else {
  console.log('No dist-esm directory found');
}