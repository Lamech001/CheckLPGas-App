#!/usr/bin/env node
/**
 * Generate app icons from source image
 * Usage: node scripts/generate-icons.js <source-image-path>
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    // Try to import sharp
    const sharp = require('sharp');
    
    // Find the uploaded image in temp directory
    const tempDir = process.env.TEMP || process.env.TMP || '/tmp';
    const possiblePaths = [
      path.join(tempDir, 'image.png'),
      path.join(tempDir, 'image.jpg'),
      path.join(tempDir, 'TemporaryItems', 'image.png'),
      path.join(tempDir, 'NSIRD_screencaptureui_*.png'),
    ];
    
    let sourceImage = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        sourceImage = p;
        break;
      }
    }
    
    if (!sourceImage) {
      console.log('Please provide the path to your GasAround icon image:');
      console.log('  node scripts/generate-icons.js <path-to-image>');
      process.exit(1);
    }
    
    console.log(`Using source image: ${sourceImage}`);
    
    const assetsDir = path.join(__dirname, '..', 'assets', 'images');
    
    // Ensure directory exists
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    
    const image = sharp(sourceImage);
    const metadata = await image.metadata();
    
    console.log(`Source: ${metadata.width}x${metadata.height}`);
    
    // Generate main icon (1024x1024 for iOS)
    await image
      .resize(1024, 1024, { fit: 'contain', background: { r: 26, g: 42, b: 83, alpha: 1 } })
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('✓ Generated icon.png (1024x1024)');
    
    // For Android adaptive icon - split into layers
    // Background (solid color from your image - dark blue #1A2A53)
    const backgroundSize = 432; // Android adaptive icon size
    const background = sharp({
      create: {
        width: backgroundSize,
        height: backgroundSize,
        channels: 4,
        background: { r: 26, g: 42, b: 83, alpha: 1 } // Dark blue
      }
    });
    await background.png().toFile(path.join(assetsDir, 'android-icon-background.png'));
    console.log('✓ Generated android-icon-background.png');
    
    // Foreground (the gas cylinder icon - cropped to center)
    // First, crop to square focusing on the center (where the cylinder is)
    const cropSize = Math.min(metadata.width, metadata.height);
    const left = Math.floor((metadata.width - cropSize) / 2);
    const top = Math.floor((metadata.height - cropSize) / 2);
    
    const foreground = sharp(sourceImage)
      .extract({ left, top, width: cropSize, height: cropSize })
      .resize(backgroundSize, backgroundSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png();
    
    await foreground.toFile(path.join(assetsDir, 'android-icon-foreground.png'));
    console.log('✓ Generated android-icon-foreground.png');
    
    // Generate splash icon (centered, larger padding)
    await image
      .resize(800, 800, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(assetsDir, 'splash-icon.png'));
    console.log('✓ Generated splash-icon.png (800x800)');
    
    // Generate favicon
    await image
      .resize(32, 32, { fit: 'contain', background: { r: 26, g: 42, b: 83, alpha: 1 } })
      .png()
      .toFile(path.join(assetsDir, 'favicon.png'));
    console.log('✓ Generated favicon.png (32x32)');
    
    // Generate notification icon (smaller, simpler)
    await image
      .resize(96, 96, { fit: 'contain', background: { r: 76, g: 175, b: 80, alpha: 1 } })
      .png()
      .toFile(path.join(assetsDir, 'notification-icon.png'));
    console.log('✓ Generated notification-icon.png (96x96)');
    
    console.log('\n✅ All icons generated successfully!');
    console.log('Run "npx expo prebuild" to generate native projects with these icons.');
    
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('Installing sharp package...');
      const { execSync } = require('child_process');
      execSync('npm install sharp --save-dev', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('Sharp installed. Please run the script again.');
    } else {
      console.error('Error:', error.message);
      console.log('\nAlternative: Manually save your image as:');
      console.log('  - assets/images/icon.png (1024x1024)');
      console.log('  - assets/images/android-icon-foreground.png');
      console.log('  - assets/images/android-icon-background.png (solid color)');
    }
  }
}

// Check for command line argument
const args = process.argv.slice(2);
if (args.length > 0) {
  // Use provided path
  process.env.CUSTOM_IMAGE_PATH = args[0];
}

generateIcons();
