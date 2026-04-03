/**
 * Vision Button Component
 * 📷 Button with sci-fi styling for image capture
 */

function VisionButton({ onCapture, onGallery, deviceType }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // Handle button click - show menu or capture
  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    
    if (deviceType.isMobile) {
      // On mobile, capture directly (camera is primary)
      await captureImage();
    } else {
      // On desktop, show menu
      setShowMenu(true);
    }
  };
  
  // Handle camera capture
  const captureImage = async () => {
    setIsCapturing(true);
    setShowMenu(false);
    
    try {
      await onCapture();
    } finally {
      setIsCapturing(false);
    }
  };
  
  // Handle gallery selection
  const openGallery = async () => {
    setIsGalleryOpen(true);
    setShowMenu(false);
    
    try {
      await onGallery();
    } finally {
      setIsGalleryOpen(false);
    }
  };
  
  // Keyboard shortcut for mobile (tap orb to capture)
  useEffect(() => {
    if (deviceType.isMobile) {
      const handleOrbClick = () => {
        if (!showMenu && !isCapturing) {
          captureImage();
        }
      };
      
      const orb = document.getElementById('jarvis-orb-container');
      if (orb) {
        orb.addEventListener('click', handleOrbClick);
      }
      
      return () => {
        if (orb) {
          orb.removeEventListener('click', handleOrbClick);
        }
      };
    }
  }, [deviceType.isMobile, showMenu, isCapturing]);
  
  return (
    <div className="vision-button-container">
      {/* Main capture button */}
      <button
        id="vision-capture-btn"
        className={`vision-btn ${isCapturing ? 'capturing' : ''} ${showMenu ? 'menu-open' : ''}`}
        onClick={handleClick}
        aria-label="Capture image"
        title={deviceType.isMobile ? "Tap to capture image" : "Click to open menu"}
      >
        {isCapturing ? (
          <span className="vision-icon capturing">📸</span>
        ) : (
          <span className="vision-icon">📷</span>
        )}
        
        {/* Sci-fi glow effect */}
        <span className="vision-glow" />
        <span className="vision-ring" />
        <span className="vision-ring delayed" />
      </button>
      
      {/* Desktop menu */}
      {deviceType.isDesktop && showMenu && (
        <div className="vision-menu">
          <button
            className="vision-menu-item camera-btn"
            onClick={captureImage}
            disabled={isCapturing}
          >
            <span className="menu-icon">📷</span>
            <span className="menu-label">Camera</span>
          </button>
          
          <button
            className="vision-menu-item gallery-btn"
            onClick={openGallery}
            disabled={isGalleryOpen}
          >
            <span className="menu-icon">🖼️</span>
            <span className="menu-label">Gallery</span>
          </button>
        </div>
      )}
      
      {/* Hidden file inputs */}
      <input
        type="file"
        id="vision-camera-input"
        className="hidden-input"
        accept="image/*"
        capture="environment"
        onChange={onCapture}
        disabled={isCapturing}
        aria-hidden="true"
      />
      
      <input
        type="file"
        id="vision-gallery-input"
        className="hidden-input"
        accept="image/*"
        onChange={onGallery}
        disabled={isGalleryOpen}
        aria-hidden="true"
      />
    </div>
  );
}

// Styling for vision button
function VisionButtonStyles() {
  return (
    <style>{`
      /* Vision Button Container */
      .vision-button-container {
        position: fixed;
        z-index: 5000;
        pointer-events: auto;
      }

      /* Main Capture Button */
      .vision-btn {
        position: relative;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(0, 255, 255, 0.15) 0%, rgba(0, 180, 255, 0.08) 100%);
        border: 2px solid rgba(0, 255, 255, 0.3);
        backdrop-filter: blur(8px);
        box-shadow:
          0 0 24px rgba(0, 255, 255, 0.12),
          0 0 4px rgba(0, 255, 255, 0.4) inset;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }

      .vision-btn:hover {
        transform: scale(1.05);
        border-color: rgba(0, 255, 255, 0.6);
        box-shadow:
          0 0 36px rgba(0, 255, 255, 0.2),
          0 0 6px rgba(0, 255, 255, 0.6) inset;
      }

      .vision-btn:active {
        transform: scale(0.95);
      }

      .vision-btn.capturing {
        animation: capture-pulse 0.5s ease-in-out infinite;
        border-color: rgba(255, 100, 100, 0.6);
      }

      /* Capture pulse animation */
      @keyframes capture-pulse {
        0%, 100% {
          box-shadow:
            0 0 24px rgba(0, 255, 255, 0.12),
            0 0 4px rgba(0, 255, 255, 0.4) inset;
        }
        50% {
          box-shadow:
            0 0 48px rgba(255, 100, 100, 0.25),
            0 0 8px rgba(255, 100, 100, 0.6) inset;
        }
      }

      /* Vision Icon */
      .vision-icon {
        font-size: 32px;
        position: relative;
        z-index: 1;
      }

      /* Sci-fi Glow Effect */
      .vision-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);
        background: radial-gradient(circle, rgba(0, 255, 255, 0.3) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .vision-btn:hover .vision-glow {
        opacity: 1;
      }

      /* Sci-fi Ring Effects */
      .vision-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 120%;
        height: 120%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 1px solid rgba(0, 255, 255, 0.2);
        animation: spin 8s linear infinite;
      }

      .vision-ring.delayed {
        animation-duration: 12s;
        animation-direction: reverse;
        border-color: rgba(0, 180, 255, 0.15);
      }

      @keyframes spin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }

      /* Desktop Menu */
      .vision-menu {
        position: absolute;
        top: 76px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(5, 10, 20, 0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 255, 255, 0.3);
        border-radius: 16px;
        padding: 8px;
        box-shadow:
          0 16px 48px rgba(0, 0, 0, 0.8),
          0 0 32px rgba(0, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 160px;
      }

      .vision-menu::before {
        content: '';
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 0 8px 10px 8px;
        border-style: solid;
        border-color: transparent transparent rgba(0, 255, 255, 0.3) transparent;
      }

      /* Menu Items */
      .vision-menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        background: rgba(0, 255, 255, 0.05);
        border: 1px solid rgba(0, 255, 255, 0.15);
        color: #c8e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .vision-menu-item:hover {
        background: rgba(0, 255, 255, 0.12);
        border-color: rgba(0, 255, 255, 0.4);
        transform: translateX(4px);
      }

      .vision-menu-item:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .menu-icon {
        font-size: 20px;
      }

      .menu-label {
        flex: 1;
      }

      /* Hidden inputs */
      .hidden-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 0;
        height: 0;
      }

      /* Mobile positioning */
      @media (max-width: 768px) {
        .vision-button-container {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 6000;
        }

        .vision-btn {
          width: 56px;
          height: 56px;
        }

        .vision-icon {
          font-size: 28px;
        }

        .vision-menu {
          position: fixed;
          top: auto;
          bottom: 96px;
          left: 50%;
          transform: translateX(-50%);
          bottom: auto !important;
          top: 96px;
        }

        .vision-menu::before {
          top: auto;
          bottom: -10px;
          transform: translateX(-50%) rotate(180deg);
        }
      }
    `}</style>
  );
}

// Export component
function VisionButtonWithStyles({ onCapture, onGallery, deviceType }) {
  return (
    <>
      <VisionButton onCapture={onCapture} onGallery={onGallery} deviceType={deviceType} />
      <VisionButtonStyles />
    </>
  );
}

export default VisionButtonWithStyles;
