'use strict';

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
  const croppedFeedContainer = document.getElementById('cropped-feed-container');

  // Array to hold multiple crop regions
  const cropRegions = [];
  let isSelecting = false;
  let startX = 0, startY = 0;
  let currentOverlay = null; // overlay for the region being created
  const ocrCooldown = 2000; // This is kept for potential future use

  // Start screen capture
  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
      videoElement.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing stopped');
        videoElement.srcObject = null;
      });
    } catch (err) {
      console.error('Error: ' + err);
      alert('An error occurred while trying to capture the screen: ' + err.message);
    }
  }

  captureBtn.addEventListener('click', () => {
    startCapture();
  });

  // Enable cropping mode on clicking "Select Crop Region"
  cropBtn.addEventListener('click', () => {
    displayContainer.style.cursor = 'crosshair';
    displayContainer.addEventListener('mousedown', startCrop);
  });

  function startCrop(e) {
    if (!videoElement.srcObject) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();
    // Only allow selection if click is within the video bounds
    if (
      e.clientX < videoRect.left ||
      e.clientX > videoRect.right ||
      e.clientY < videoRect.top ||
      e.clientY > videoRect.bottom
    ) {
      return;
    }
    isSelecting = true;
    startX = e.clientX - videoRect.left;
    startY = e.clientY - videoRect.top;
    // Create a new overlay for this crop region
    currentOverlay = document.createElement('div');
    currentOverlay.className = 'crop-overlay';
    const videoOffsetX = videoRect.left - containerRect.left;
    const videoOffsetY = videoRect.top - containerRect.top;
    currentOverlay.style.left = (videoOffsetX + startX) + 'px';
    currentOverlay.style.top = (videoOffsetY + startY) + 'px';
    currentOverlay.style.width = '0px';
    currentOverlay.style.height = '0px';
    displayContainer.appendChild(currentOverlay);

    document.addEventListener('mousemove', onCropMove);
    document.addEventListener('mouseup', endCrop);
    // Prevent starting another crop concurrently
    displayContainer.removeEventListener('mousedown', startCrop);
  }

  function onCropMove(e) {
    if (!isSelecting) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();
    const videoOffsetX = videoRect.left - containerRect.left;
    const videoOffsetY = videoRect.top - containerRect.top;
    // Clamp current mouse position to video bounds
    const currentClientX = Math.min(Math.max(e.clientX, videoRect.left), videoRect.right);
    const currentClientY = Math.min(Math.max(e.clientY, videoRect.top), videoRect.bottom);
    const currentXRel = currentClientX - videoRect.left;
    const currentYRel = currentClientY - videoRect.top;
    const relX = Math.min(startX, currentXRel);
    const relY = Math.min(startY, currentYRel);
    const width = Math.abs(currentXRel - startX);
    const height = Math.abs(currentYRel - startY);
    // Update overlay dimensions and position
    currentOverlay.style.left = (videoOffsetX + relX) + 'px';
    currentOverlay.style.top = (videoOffsetY + relY) + 'px';
    currentOverlay.style.width = width + 'px';
    currentOverlay.style.height = height + 'px';
  }

  function endCrop(e) {
    if (!isSelecting) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();
    const videoOffsetX = videoRect.left - containerRect.left;
    const videoOffsetY = videoRect.top - containerRect.top;
    // Clamp release position to video bounds
    const endClientX = Math.min(Math.max(e.clientX, videoRect.left), videoRect.right);
    const endClientY = Math.min(Math.max(e.clientY, videoRect.top), videoRect.bottom);
    const endXRel = endClientX - videoRect.left;
    const endYRel = endClientY - videoRect.top;
    const rectLeft = Math.min(startX, endXRel);
    const rectTop = Math.min(startY, endYRel);
    const rectWidth = Math.abs(endXRel - startX);
    const rectHeight = Math.abs(endYRel - startY);

    document.removeEventListener('mousemove', onCropMove);
    document.removeEventListener('mouseup', endCrop);
    isSelecting = false;

    if (rectWidth > 10 && rectHeight > 10) {
      // Create a new crop region object
      const region = {
        x: rectLeft,
        y: rectTop,
        w: rectWidth,
        h: rectHeight,
        overlay: currentOverlay,
        lastOCRHash: null,
        lastOCRTime: 0,
        isOCRProcessing: false,
        container: null,
        canvas: null,
        ctx: null,
        colorPickerSwatch: null,
        colorHexValue: null,
        ocrResultElement: null
      };
      cropRegions.push(region);

      // Create UI for this crop region in the cropped feed section
      const regionContainer = document.createElement('div');
      regionContainer.className = 'crop-region';

      const canvas = document.createElement('canvas');
      canvas.width = rectWidth;
      canvas.height = rectHeight;
      // Scale CSS display size to 250%
      canvas.style.width = (rectWidth * 2.5) + 'px';
      canvas.style.height = (rectHeight * 2.5) + 'px';
      regionContainer.appendChild(canvas);

      // Color picker for this cropped region
      const colorPickerDiv = document.createElement('div');
      colorPickerDiv.className = 'color-picker-region';
      const label = document.createElement('label');
      label.textContent = 'Click on cropped area to pick color:';
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      const hexValueSpan = document.createElement('span');
      hexValueSpan.className = 'color-hex-value';
      hexValueSpan.textContent = '#FFFFFF';
      colorPickerDiv.appendChild(label);
      colorPickerDiv.appendChild(swatch);
      colorPickerDiv.appendChild(hexValueSpan);
      regionContainer.appendChild(colorPickerDiv);

      // OCR result container with manual trigger for this region
      const ocrDiv = document.createElement('div');
      ocrDiv.className = 'ocr-result-region';
      const ocrHeader = document.createElement('h2');
      ocrHeader.textContent = 'OCR Result';
      ocrDiv.appendChild(ocrHeader);

      const runOCRBtn = document.createElement('button');
      runOCRBtn.textContent = 'Run OCR';
      runOCRBtn.style.margin = '10px';
      runOCRBtn.addEventListener('click', () => {
        if (!region.isOCRProcessing) {
          performOCRForRegion(region, region.canvas);
        }
      });
      ocrDiv.appendChild(runOCRBtn);

      const ocrParagraph = document.createElement('p');
      ocrParagraph.textContent = '';
      ocrDiv.appendChild(ocrParagraph);
      regionContainer.appendChild(ocrDiv);

      croppedFeedContainer.appendChild(regionContainer);

      // Save UI element references in the region object
      region.container = regionContainer;
      region.canvas = canvas;
      region.ctx = canvas.getContext('2d');
      region.colorPickerSwatch = swatch;
      region.colorHexValue = hexValueSpan;
      region.ocrResultElement = ocrParagraph;

      // Add color picker functionality to the region's canvas
      canvas.addEventListener('click', (ev) => {
        if (!canvas.width || !canvas.height) return;
        const rect = canvas.getBoundingClientRect();
        const scaleFactor = canvas.width / rect.width;
        const x = Math.floor((ev.clientX - rect.left) * scaleFactor);
        const y = Math.floor((ev.clientY - rect.top) * scaleFactor);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
        const pixelData = region.ctx.getImageData(x, y, 1, 1).data;
        const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
        swatch.style.backgroundColor = hexColor;
        hexValueSpan.textContent = hexColor;
      });

      // Show the Reset Crops button since we have at least one crop region
      resetCropBtn.style.display = 'inline-block';
    } else {
      // If the selection was too small, remove the overlay
      displayContainer.removeChild(currentOverlay);
    }

    currentOverlay = null;
    // Re-enable mousedown listener for additional crops
    displayContainer.addEventListener('mousedown', startCrop);
    displayContainer.style.cursor = 'default';
  }

  // Reset all crop regions
  resetCropBtn.addEventListener('click', () => {
    cropRegions.forEach(region => {
      if (region.overlay && region.overlay.parentNode) {
        region.overlay.parentNode.removeChild(region.overlay);
      }
    });
    cropRegions.length = 0;
    croppedFeedContainer.innerHTML = '';
    resetCropBtn.style.display = 'none';
  });

  // Continuously update the cropped feeds for all regions (without automatic OCR)
  function updateCroppedFeed() {
    if (!videoElement.srcObject) {
      cropRegions.forEach(region => {
        region.ctx.clearRect(0, 0, region.canvas.width, region.canvas.height);
      });
      requestAnimationFrame(updateCroppedFeed);
      return;
    }
    const videoRect = videoElement.getBoundingClientRect();
    const scaleX = videoElement.videoWidth / videoRect.width;
    const scaleY = videoElement.videoHeight / videoRect.height;

    // List of colors to replace with bright pink (#FF00FF) including additional colors to remove
    const targetColors = [
      { r: 0x29, g: 0x2c, b: 0x29 },
      { r: 0x29, g: 0x2a, b: 0x29 },
      { r: 0x2a, g: 0x2c, b: 0x29 },
      { r: 0x29, g: 0x2e, b: 0x2a },
      { r: 0x30, g: 0x30, b: 0x30 },
      { r: 0x89, g: 0x89, b: 0x89 },
      { r: 0xe9, g: 0xe0, b: 0x2c },
      { r: 0xad, g: 0xa9, b: 0x4b },
      { r: 0x90, g: 0x90, b: 0x90 },
      { r: 0x76, g: 0x76, b: 0x76 },
      { r: 0x7d, g: 0x7d, b: 0x62 },
      { r: 0xe7, g: 0xe1, b: 0x47 },
      { r: 0x26, g: 0x28, b: 0x26 },
      { r: 0x00, g: 0x00, b: 0x00 },
      { r: 0x55, g: 0x55, b: 0x44 },
      { r: 0x2d, g: 0x2e, b: 0x2d },
      { r: 0x49, g: 0x4a, b: 0x49 },
      { r: 0x59, g: 0x56, b: 0x2f },
      { r: 0x44, g: 0x45, b: 0x30 },
      { r: 0x2c, g: 0x31, b: 0x2d },
      { r: 0x30, g: 0x3f, b: 0x2c },
      { r: 0x72, g: 0x72, b: 0x72 },
      { r: 0x62, g: 0x63, b: 0x45 },
      { r: 0x92, g: 0x8e, b: 0x26 },
      { r: 0x6e, g: 0x6e, b: 0x52 },
      { r: 0x21, g: 0x23, b: 0x21 },
      { r: 0x5a, g: 0x5b, b: 0x4e },
      { r: 0x44, g: 0x58, b: 0x41 },
      { r: 0x4b, g: 0x59, b: 0x49 },
      { r: 0x5e, g: 0x5e, b: 0x5e },
      { r: 0x1f, g: 0x1f, b: 0x1f },
      { r: 0x1e, g: 0x1f, b: 0x1e }
    ];
    const tolerance = 2;

    cropRegions.forEach(region => {
      const videoCropX = region.x * scaleX;
      const videoCropY = region.y * scaleY;
      const videoCropWidth = region.w * scaleX;
      const videoCropHeight = region.h * scaleY;
      region.canvas.width = region.w;
      region.canvas.height = region.h;
      region.ctx.drawImage(
        videoElement,
        videoCropX,
        videoCropY,
        videoCropWidth,
        videoCropHeight,
        0,
        0,
        region.w,
        region.h
      );

      const imageData = region.ctx.getImageData(0, 0, region.w, region.h);
      const data = imageData.data;
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
            data[i] = 255;
            data[i + 1] = 0;
            data[i + 2] = 255;
            data[i + 3] = 255;
            break;
          }
        }
      }
      region.ctx.putImageData(imageData, 0, 0);
    });
    requestAnimationFrame(updateCroppedFeed);
  }

  requestAnimationFrame(updateCroppedFeed);

  async function performOCRForRegion(region, sourceCanvas) {
    region.isOCRProcessing = true;
    region.ocrResultElement.textContent = 'Processing OCR...';
    const preprocessedCanvas = preprocessCanvasForOCR(sourceCanvas);
    try {
      const { data: { text } } = await ocrWorker.recognize(preprocessedCanvas);
      region.ocrResultElement.textContent = text.trim() || 'No text recognized.';
    } catch (err) {
      console.error('OCR error:', err);
      region.ocrResultElement.textContent = 'OCR Error: ' + err;
    }
    region.isOCRProcessing = false;
  }

  function preprocessCanvasForOCR(sourceCanvas) {
    const scaleFactor = 2;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const scaledWidth = width * scaleFactor;
    const scaledHeight = height * scaleFactor;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = scaledWidth;
    offCanvas.height = scaledHeight;
    const offCtx = offCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(sourceCanvas, 0, 0, scaledWidth, scaledHeight);
    const imageData = offCtx.getImageData(0, 0, scaledWidth, scaledHeight);
    const data = imageData.data;
    const threshold = 128;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const binaryColor = gray < threshold ? 0 : 255;
      data[i] = binaryColor;
      data[i+1] = binaryColor;
      data[i+2] = binaryColor;
      data[i+3] = 255;
    }
    offCtx.putImageData(imageData, 0, 0);
    return offCanvas;
  }

  function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }
})();