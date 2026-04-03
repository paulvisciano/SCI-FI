/**
 * archive-image.js - Save images to ~/RAW/archive/YYYY-MM-DD/images/
 */

const fs = require('fs');
const path = require('path');

// Archive base directory
const ARCHIVE_BASE = '~/RAW/archive';

/**
 * Get archive directory for today's images
 * @returns {string} Archive path for today's date
 */
function getTodayArchivePath() {
  const today = new Date().toISOString().split('T')[0];
  const archivePath = path.join(ARCHIVE_BASE, today, 'images');
  return archivePath;
}

/**
 * Ensure archive directory exists
 * @param {string} archivePath - Path to archive directory
 * @returns {Promise<string>} Archive path
 */
async function ensureArchiveDirectory(archivePath) {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(archivePath)) {
      fs.mkdirSync(archivePath, { recursive: true });
      console.log(`[archive-image] Created archive directory: ${archivePath}`);
    }
    return archivePath;
  } catch (err) {
    console.error('[archive-image] Failed to create archive directory:', err);
    throw err;
  }
}

/**
 * Generate unique filename for image
 * @param {string} extension - File extension (jpg, png, etc.)
 * @returns {string} Timestamped filename
 */
function generateImageFilename(extension = 'jpg') {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '').split('T')[0] + '-' + 
                    now.toTimeString().split(' ')[0].replace(/:/g, '');
  const hash = Math.random().toString(36).substring(2, 8);
  return `vision-${timestamp}-${hash}.${extension}`;
}

/**
 * Archive image to daily directory
 * @param {Buffer|string} imageData - Image data (Buffer or base64 string)
 * @param {string} filename - Filename for the image
 * @returns {Promise<string>} Archive path
 */
async function archiveImage(imageData, filename) {
  try {
    // Get today's archive path
    const archivePath = getTodayArchivePath();
    const fullArchivePath = path.join(ARCHIVE_BASE.split('~')[0], archivePath);
    
    // Ensure directory exists
    await ensureArchiveDirectory(fullArchivePath);
    
    // Construct full file path
    const filePath = path.join(fullArchivePath, filename);
    
    // Write image data
    if (Buffer.isBuffer(imageData)) {
      fs.writeFileSync(filePath, imageData);
    } else if (typeof imageData === 'string') {
      // Handle base64 string
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
    } else {
      throw new Error('Invalid image data type');
    }
    
    console.log(`[archive-image] Image archived to: ${filePath}`);
    return filePath;
  } catch (err) {
    console.error('[archive-image] Failed to archive image:', err);
    throw err;
  }
}

/**
 * Get archive file list for a date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<string[]>} List of archived image files
 */
async function getArchiveFileList(dateStr) {
  try {
    const archivePath = path.join(ARCHIVE_BASE.split('~')[0], dateStr, 'images');
    if (!fs.existsSync(archivePath)) {
      return [];
    }
    
    const files = fs.readdirSync(archivePath)
      .filter(file => file.startsWith('vision-') && /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
    
    return files.map(file => path.join(archivePath, file));
  } catch (err) {
    console.error('[archive-image] Failed to get archive file list:', err);
    throw err;
  }
}

/**
 * Delete old archive files (cleanup)
 * @param {number} daysToKeep - Number of days to keep files
 * @returns {Promise<void>}
 */
async function cleanupOldArchives(daysToKeep = 30) {
  try {
    const today = new Date();
    const cutoffDate = new Date(today.getTime() - daysToKeep * 24 * 60 * 60 * 1000);
    
    // Get all date directories
    const archiveBase = ARCHIVE_BASE.split('~')[0];
    if (!fs.existsSync(archiveBase)) {
      return;
    }
    
    const dateDirs = fs.readdirSync(archiveBase)
      .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir))
      .filter(dir => new Date(dir) < cutoffDate);
    
    // Delete old date directories
    for (const dateDir of dateDirs) {
      const imageDir = path.join(archiveBase, dateDir, 'images');
      if (fs.existsSync(imageDir)) {
        fs.rmSync(imageDir, { recursive: true, force: true });
        console.log(`[archive-image] Cleaned up old archive: ${dateDir}`);
      }
    }
  } catch (err) {
    console.error('[archive-image] Failed to cleanup old archives:', err);
    throw err;
  }
}

// Export functions
module.exports = {
  getTodayArchivePath,
  ensureArchiveDirectory,
  generateImageFilename,
  archiveImage,
  getArchiveFileList,
  cleanupOldArchives
};
