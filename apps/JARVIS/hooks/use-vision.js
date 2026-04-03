/**
 * use-vision.js - Vision capabilities hook for JARVIS
 * Provides camera capture, gallery selection, and archive integration
 */

// Archive configuration
const ARCHIVE_BASE = '~/RAW/archive';

/**
 * Get archive directory for today's images
 * @returns {string} Archive path for today's date
 */
function getTodayArchivePath() {
  const today = new Date().toISOString().split('T')[0];
  return `${ARCHIVE_BASE}/${today}/images/`;
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
 * @param {Blob} imageBlob - Image blob to archive
 * @param {string} filename - Desired filename
 * @returns {Promise<string>} Archive path
 */
async function archiveImage(imageBlob, filename) {
  try {
    const formData = new FormData();
    formData.append('image', imageBlob, filename);
    
    // Try to upload to server for archiving
    const API_BASE = window.location.protocol + '//' + (window.location.host || 'localhost:18787');
    const response = await fetch(`${API_BASE}/api/archive/image`, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('[vision] Image archived:', result.path);
      return result.path;
    }
  } catch (err) {
    console.warn('[vision] Archive upload failed, saving locally:', err);
    // Fallback: save to browser Downloads
    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return `~/Downloads/${filename}`;
  }
  
  return null;
}

/**
 * Get user agent info for mobile/desktop detection
 * @returns {{isMobile: boolean, isDesktop: boolean}}
 */
function getDeviceType() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return {
    isMobile: /android|iphone|ipad|ipod/i.test(ua),
    isDesktop: !/android|iphone|ipad|ipod/i.test(ua)
  };
}

/**
 * Hook: useVision
 * Provides vision capabilities for JARVIS
 * @returns {Object} Vision API
 */
function useVision() {
  const [deviceType, setDeviceType] = useState(getDeviceType());
  
  // Handle image selection from file picker
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return null;
    
    if (!file.type.startsWith('image/')) {
      console.warn('[vision] Selected file is not an image');
      return null;
    }
    
    return processImage(file);
  };
  
  // Handle camera capture
  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: deviceType.isMobile ? 'environment' : 'user' } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      // Get image as blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      
      // Stop video stream
      stream.getTracks().forEach(track => track.stop());
      
      return processImage(blob, 'camera');
    } catch (err) {
      console.error('[vision] Camera capture failed:', err);
      return null;
    }
  };
  
  // Handle gallery selection (mobile)
  const handleGallerySelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return null;
    
    if (!file.type.startsWith('image/')) {
      console.warn('[vision] Selected file is not an image');
      return null;
    }
    
    return processImage(file, 'gallery');
  };
  
  // Process image (archive + return metadata)
  const processImage = async (file, source = 'unknown') => {
    try {
      // Archive the image
      const filename = generateImageFilename(file.name.split('.').pop() || 'jpg');
      const archivePath = await archiveImage(file, filename);
      
      // Create image object for preview
      const imageUrl = URL.createObjectURL(file);
      
      return {
        file,
        blob: file,
        url: imageUrl,
        archivePath,
        source,
        timestamp: new Date().toISOString(),
        metadata: {
          name: file.name,
          type: file.type,
          size: file.size,
          width: file.type === 'image/jpeg' ? 1920 : 1080, // placeholder
          height: file.type === 'image/jpeg' ? 1080 : 1920
        }
      };
    } catch (err) {
      console.error('[vision] Image processing failed:', err);
      return null;
    }
  };
  
  // Send image to Jarvis via message tool
  const sendImageToJarvis = async (imageData) => {
    if (!imageData || !imageData.blob) {
      console.error('[vision] No image data to send');
      return false;
    }
    
    try {
      // Convert blob to base64 for message tool
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageData.blob);
      });
      
      // Send to OpenClaw via message tool
      window.openclaw?.message?.({
        action: 'send',
        message: `📷 *Image received* from ${imageData.source}.\n\n**Source:** ${imageData.source}\n**Size:** ${(imageData.blob.size / 1024).toFixed(1)} KB\n**Timestamp:** ${imageData.timestamp}\n**Archive:** ${imageData.archivePath}\n\n![Image Preview](data:${imageData.blob.type};base64,${base64Image.split(',')[1].substring(0, 100)}...)`,
        channel: 'webchat'
      });
      
      // Also upload to server via fetch
      const API_BASE = window.location.protocol + '//' + (window.location.host || 'localhost:18787');
      const formData = new FormData();
      formData.append('image', imageData.blob, imageData.blob.name || 'vision-image.jpg');
      
      const response = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        console.log('[vision] Image sent to Jarvis');
        return true;
      }
    } catch (err) {
      console.error('[vision] Failed to send image to Jarvis:', err);
      return false;
    }
    
    return false;
  };
  
  // Cleanup function
  const cleanup = () => {
    // Clean up object URLs
    // This would be called when component unmounts
  };
  
  return {
    deviceType,
    handleFileSelect,
    handleCameraCapture,
    handleGallerySelect,
    processImage,
    sendImageToJarvis,
    getTodayArchivePath,
    generateImageFilename,
    cleanup
  };
}

// Export for use in components
export default useVision;
export { getTodayArchivePath, generateImageFilename, archiveImage, getDeviceType };
