const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load environment variables from root .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN;
const FIGMA_FILE = process.env.FIGMA_FILE_KEY;

if (!FIGMA_TOKEN || !FIGMA_FILE) {
  console.error('❌ Error: Please configure FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY in your .env file.');
  process.exit(1);
}

async function sync() {
  console.log('🔄 Connecting to Figma API...');
  try {
    // 1. Fetch styles metadata
    const stylesUrl = `https://api.figma.com/v1/files/${FIGMA_FILE}/styles`;
    const stylesRes = await axios.get(stylesUrl, {
      headers: { 'X-Figma-Token': FIGMA_TOKEN }
    });

    const styles = stylesRes.data.meta?.styles || [];
    if (styles.length === 0) {
      console.warn('⚠️ No styles defined in this Figma file. Make sure you have color or text styles published.');
      // Create an empty tokens file just in case
      fs.writeFileSync(path.join(__dirname, '../frontend/src/figma-tokens.css'), '/* No Figma styles found */\n');
      return;
    }

    console.log(`Found ${styles.length} styles in Figma. Fetching style node details...`);

    // Extract node IDs
    const nodeIds = styles.map(s => s.node_id);
    
    // 2. Fetch specific node details
    const nodesUrl = `https://api.figma.com/v1/files/${FIGMA_FILE}/nodes?ids=${nodeIds.join(',')}`;
    const nodesRes = await axios.get(nodesUrl, {
      headers: { 'X-Figma-Token': FIGMA_TOKEN }
    });

    const nodes = nodesRes.data.nodes || {};

    let cssContent = `/* 🎨 Generated Design Tokens from Figma */\n/* Generated on: ${new Date().toISOString()} */\n\n:root {\n`;

    for (const styleMeta of styles) {
      const nodeDetail = nodes[styleMeta.node_id];
      if (!nodeDetail) continue;

      const doc = nodeDetail.document;
      const cleanName = styleMeta.name
        .toLowerCase()
        .replace(/[\s/]+/g, '-') // Replace spaces and slashes with hyphens
        .replace(/[^a-z0-9-]/g, ''); // Remove special characters

      if (styleMeta.style_type === 'FILL') {
        const fill = doc.fills?.[0];
        if (fill && fill.type === 'SOLID') {
          const { r, g, b, a } = fill.color;
          const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
          const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          cssContent += `  --figma-color-${cleanName}: ${hex};\n`;
          console.log(`✨ Imported color style: --figma-color-${cleanName} -> ${hex}`);
        }
      } else if (styleMeta.style_type === 'TEXT') {
        const textStyle = doc.style;
        if (textStyle) {
          if (textStyle.fontSize) {
            cssContent += `  --figma-font-size-${cleanName}: ${textStyle.fontSize}px;\n`;
          }
          if (textStyle.fontFamily) {
            cssContent += `  --figma-font-family-${cleanName}: '${textStyle.fontFamily}';\n`;
          }
          if (textStyle.fontWeight) {
            cssContent += `  --figma-font-weight-${cleanName}: ${textStyle.fontWeight};\n`;
          }
          console.log(`✨ Imported text style: --figma-font-${cleanName}`);
        }
      }
    }

    cssContent += '}\n';

    // 3. Write figma-tokens.css
    const outputPath = path.join(__dirname, '../frontend/src/figma-tokens.css');
    fs.writeFileSync(outputPath, cssContent);
    console.log(`\n✅ Figma design tokens written successfully to: ${outputPath}`);

    // 4. Check if it's imported in index.css
    const indexCssPath = path.join(__dirname, '../frontend/src/index.css');
    if (fs.existsSync(indexCssPath)) {
      let indexCss = fs.readFileSync(indexCssPath, 'utf8');
      if (!indexCss.includes("figma-tokens.css")) {
        indexCss = `@import './figma-tokens.css';\n` + indexCss;
        fs.writeFileSync(indexCssPath, indexCss);
        console.log(`🔗 Linked figma-tokens.css inside index.css`);
      }
    }
  } catch (err) {
    console.error('❌ Error syncing with Figma API:', err.response?.data?.message || err.message);
    process.exit(1);
  }
}

sync();
