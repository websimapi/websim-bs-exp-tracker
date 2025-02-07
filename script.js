'use strict';

// Encapsulate logic in an IIFE
(() => {
  // Initialize OCR Worker using Tesseract.createWorker
  let ocrWorker;
  (async function initOCR() {
    ocrWorker = Tesseract.createWorker({
      logger: m => console.log(m),
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@2.1.5/dist/worker.min.js'
    });
    await ocrWorker.load();
    await ocrWorker.loadLanguage('eng');
    await ocrWorker.initialize('eng');
    console.log('OCR Worker initialized');
  })();

  const captureBtn = document.getElementById('capture-btn');
  const videoElement = document.getElementById('capture-video');
  const cropBtn = document.getElementById('crop-btn');
  const resetCropBtn = document.getElementById('reset-crop-btn');
  const displayContainer = document.getElementById('display-container');
  const cropOverlay = document.getElementById('crop-overlay');
  const croppedCanvas = document.getElementById('cropped-canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  let cropRegion = null; // { x, y, w, h } relative to the video element's displayed area
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let cropAnimationFrameID = null;
  
  // Variables for OCR throttling
  let lastOCRTime = 0;
  const ocrCooldown = 2000; // milliseconds
  let isOCRProcessing = false;

  // Start screen capture
  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      videoElement.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing stopped');
        videoElement.srcObject = null;
      });
    } catch (err) {
      console.error("Error: " + err);
      alert("An error occurred while trying to capture the screen: " + err.message);
    }
  }

  captureBtn.addEventListener('click', () => {
    startCapture();
  });

  // Enable crop selection mode
  cropBtn.addEventListener('click', () => {
    cropRegion = null;
    cropOverlay.style.display = 'none';
    resetCropBtn.style.display = 'none';
    displayContainer.addEventListener('mousedown', startCrop);
    displayContainer.style.cursor = 'crosshair';
  });

  // Begin crop selection
  function startCrop(e) {
    if (!videoElement.srcObject) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();
    // Only allow selection if the click is within the video bounds
    if (
      e.clientX < videoRect.left ||
      e.clientX > videoRect.right ||
      e.clientY < videoRect.top ||
      e.clientY > videoRect.bottom
    ) {
      return;
    }
    isSelecting = true;
    // Calculate starting coordinates relative to the video element
    startX = e.clientX - videoRect.left;
    startY = e.clientY - videoRect.top;
    const videoOffsetX = videoRect.left - containerRect.left;
    const videoOffsetY = videoRect.top - containerRect.top;
    // Initialize crop overlay at the starting point
    cropOverlay.style.display = 'block';
    cropOverlay.style.left = (videoOffsetX + startX) + 'px';
    cropOverlay.style.top = (videoOffsetY + startY) + 'px';
    cropOverlay.style.width = '0px';
    cropOverlay.style.height = '0px';

    document.addEventListener('mousemove', onCropMove);
    document.addEventListener('mouseup', endCrop);
    displayContainer.removeEventListener('mousedown', startCrop);
  }

  // Update crop overlay during selection
  function onCropMove(e) {
    if (!isSelecting) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();
    const videoOffsetX = videoRect.left - containerRect.left;
    const videoOffsetY = videoRect.top - containerRect.top;
    // Clamp the current mouse position to the video bounds
    const currentClientX = Math.min(Math.max(e.clientX, videoRect.left), videoRect.right);
    const currentClientY = Math.min(Math.max(e.clientY, videoRect.top), videoRect.bottom);
    const currentXRel = currentClientX - videoRect.left;
    const currentYRel = currentClientY - videoRect.top;
    const relX = Math.min(startX, currentXRel);
    const relY = Math.min(startY, currentYRel);
    const width = Math.abs(currentXRel - startX);
    const height = Math.abs(currentYRel - startY);
    // Position the crop overlay (using container coordinates)
    cropOverlay.style.left = (videoOffsetX + relX) + 'px';
    cropOverlay.style.top = (videoOffsetY + relY) + 'px';
    cropOverlay.style.width = width + 'px';
    cropOverlay.style.height = height + 'px';
  }

  // Finalize crop selection on mouse release
  function endCrop(e) {
    if (!isSelecting) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();
    const videoOffsetX = videoRect.left - containerRect.left;
    const videoOffsetY = videoRect.top - containerRect.top;
    // Clamp the release position to video bounds
    const endClientX = Math.min(Math.max(e.clientX, videoRect.left), videoRect.right);
    const endClientY = Math.min(Math.max(e.clientY, videoRect.top), videoRect.bottom);
    const endXRel = endClientX - videoRect.left;
    const endYRel = endClientY - videoRect.top;
    const rectLeft = Math.min(startX, endXRel);
    const rectTop = Math.min(startY, endYRel);
    const rectWidth = Math.abs(endXRel - startX);
    const rectHeight = Math.abs(endYRel - startY);
    // Only register a legitimate crop if the area is large enough
    if (rectWidth > 10 && rectHeight > 10) {
      cropRegion = { x: rectLeft, y: rectTop, w: rectWidth, h: rectHeight };
      resetCropBtn.style.display = 'inline-block';
      if (!cropAnimationFrameID) {
        updateCroppedFeed();
      }
    } else {
      cropOverlay.style.display = 'none';
    }
    isSelecting = false;
    document.removeEventListener('mousemove', onCropMove);
    document.removeEventListener('mouseup', endCrop);
    displayContainer.addEventListener('mousedown', startCrop);
    displayContainer.style.cursor = 'default';
  }

  // Continuously update the cropped feed canvas, swapping target color pixels to bright pink (#FF00FF)
  function updateCroppedFeed() {
    if (!cropRegion || !videoElement.srcObject) {
      croppedCtx.clearRect(0, 0, croppedCanvas.width, croppedCanvas.height);
      cropAnimationFrameID = null;
      return;
    }
    const videoRect = videoElement.getBoundingClientRect();
    const scaleX = videoElement.videoWidth / videoRect.width;
    const scaleY = videoElement.videoHeight / videoRect.height;
    const videoCropX = cropRegion.x * scaleX;
    const videoCropY = cropRegion.y * scaleY;
    const videoCropWidth = cropRegion.w * scaleX;
    const videoCropHeight = cropRegion.h * scaleY;
    croppedCanvas.width = cropRegion.w;
    croppedCanvas.height = cropRegion.h;
    // Set the CSS display size to 250% of the internal resolution for easier viewing
    croppedCanvas.style.width = (cropRegion.w * 2.5) + 'px';
    croppedCanvas.style.height = (cropRegion.h * 2.5) + 'px';
    croppedCtx.drawImage(
      videoElement,
      videoCropX,
      videoCropY,
      videoCropWidth,
      videoCropHeight,
      0,
      0,
      cropRegion.w,
      cropRegion.h
    );

    // Swap target pixels to bright pink (#FF00FF)
    const imageData = croppedCtx.getImageData(0, 0, cropRegion.w, cropRegion.h);
    const data = imageData.data;
    const tolerance = 2; // Allow a variation of +/-2 per RGB component
    // List of colors to remove (swap to bright pink)
    const targetColors = [
      { r: 0x29, g: 0x2c, b: 0x29 }, // #292c29
      { r: 0x29, g: 0x2a, b: 0x29 }, // #292a29
      { r: 0x2a, g: 0x2c, b: 0x29 }, // #2a2c29
      { r: 0x29, g: 0x2e, b: 0x2a }, // #292e2a
      { r: 0x30, g: 0x30, b: 0x30 }, // #303030
      { r: 0x89, g: 0x89, b: 0x89 }, // #898989
      { r: 0xe9, g: 0xe0, b: 0x2c }, // #e9e02c
      { r: 0xad, g: 0xa9, b: 0x4b }, // #ada94b
      { r: 0x90, g: 0x90, b: 0x90 }, // #909090
      { r: 0x76, g: 0x76, b: 0x76 }, // #767676
      { r: 0x7d, g: 0x7d, b: 0x62 }, // #7d7d62
      { r: 0xe7, g: 0xe1, b: 0x47 }, // #e7e147
      { r: 0x26, g: 0x28, b: 0x26 }, // #262826
      { r: 0x00, g: 0x00, b: 0x00 }, // black
      { r: 0x55, g: 0x55, b: 0x44 }, // #555544
      { r: 0x2d, g: 0x2e, b: 0x2d }, // #2d2e2d
      { r: 0x49, g: 0x4a, b: 0x49 }, // #494a49
      { r: 0x59, g: 0x56, b: 0x2f }, // #59562f
      { r: 0x44, g: 0x45, b: 0x30 }, // #444530
      { r: 0x2c, g: 0x31, b: 0x2d }, // #2c312d
      { r: 0x30, g: 0x3f, b: 0x2c }, // #303f2c
      { r: 0x72, g: 0x72, b: 0x72 }, // #727272
      { r: 0x62, g: 0x63, b: 0x45 }, // #626345
      { r: 0x92, g: 0x8e, b: 0x26 }, // #928e26
      { r: 0x6e, g: 0x6e, b: 0x52 }, // #6e6e52
      { r: 0x21, g: 0x23, b: 0x21 }, // #212321
      { r: 0x5a, g: 0x5b, b: 0x4e }, // #5a5b4e
      { r: 0x44, g: 0x58, b: 0x41 }, // #445841
      { r: 0x4b, g: 0x59, b: 0x49 }, // #4b5949
      { r: 0x5e, g: 0x5e, b: 0x5e }  // #5e5e5e
    ];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      for (const color of targetColors) {
        if (
          Math.abs(r - color.r) <= tolerance &&
          Math.abs(g - color.g) <= tolerance &&
          Math.abs(b - color.b) <= tolerance
        ) {
          // Swap the pixel color to bright pink (#FF00FF)
          data[i] = 255;    // Red
          data[i + 1] = 0;  // Green
          data[i + 2] = 255; // Blue
          data[i + 3] = 255; // Fully opaque
          break;
        }
      }
    }
    croppedCtx.putImageData(imageData, 0, 0);

    // Perform OCR on the cropped feed every ocrCooldown interval,
    // after preprocessing the image to enhance contrast and clarity.
    if (croppedCanvas.width > 0 && (Date.now() - lastOCRTime > ocrCooldown) && !isOCRProcessing) {
      performOCR();
      lastOCRTime = Date.now();
    }

    cropAnimationFrameID = requestAnimationFrame(updateCroppedFeed);
  }

  // Reset crop selection on user request
  resetCropBtn.addEventListener('click', () => {
    cropRegion = null;
    cropOverlay.style.display = 'none';
    resetCropBtn.style.display = 'none';
    if (cropAnimationFrameID) {
      cancelAnimationFrame(cropAnimationFrameID);
      cropAnimationFrameID = null;
    }
    displayContainer.addEventListener('mousedown', startCrop);
  });

  // Color Picker Tool for Cropped Canvas
  croppedCanvas.addEventListener('click', (e) => {
    // Ensure the canvas has valid dimensions
    if (!croppedCanvas.width || !croppedCanvas.height) return;
    const rect = croppedCanvas.getBoundingClientRect();
    // Calculate scale factor between internal resolution and displayed size
    const scaleFactor = croppedCanvas.width / rect.width;
    const x = Math.floor((e.clientX - rect.left) * scaleFactor);
    const y = Math.floor((e.clientY - rect.top) * scaleFactor);
    // Boundary check
    if (x < 0 || y < 0 || x > croppedCanvas.width || y > croppedCanvas.height) return;
    const pixelData = croppedCtx.getImageData(x, y, 1, 1).data;
    const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
    document.getElementById('picked-color-swatch').style.backgroundColor = hexColor;
    document.getElementById('color-hex-value').textContent = hexColor;
  });

  // Auto OCR function using Tesseract.js on cropped feed after preprocessing for improved accuracy
  async function performOCR() {
    isOCRProcessing = true;
    const ocrTextEl = document.getElementById('ocr-text');
    ocrTextEl.textContent = "Processing OCR...";
    
    // Preprocess the cropped canvas to enhance contrast (grayscale & binary thresholding)
    const preprocessedCanvas = preprocessCanvasForOCR(croppedCanvas);
    
    try {
      const { data: { text } } = await ocrWorker.recognize(preprocessedCanvas);
      ocrTextEl.textContent = text.trim() || "No text recognized.";
    } catch (err) {
      console.error("OCR error:", err);
      ocrTextEl.textContent = "OCR Error: " + err;
    }
    isOCRProcessing = false;
  }

  // Function to preprocess the canvas image for improved OCR accuracy
  function preprocessCanvasForOCR(sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    
    // Get the image data from the source (cropped) canvas
    const sourceCtx = sourceCanvas.getContext('2d');
    const imageData = sourceCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const threshold = 128; // Threshold for binarization

    // Convert each pixel to grayscale and apply thresholding for clear contrast
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const binaryColor = gray < threshold ? 0 : 255;
      data[i] = binaryColor;
      data[i + 1] = binaryColor;
      data[i + 2] = binaryColor;
      data[i + 3] = 255;
    }
    
    offCtx.putImageData(imageData, 0, 0);
    return offCanvas;
  }

  // Helper functions to convert RGB values to Hex
  function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }
  
  function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }
})();