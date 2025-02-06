'use strict';

// Encapsulate logic in an IIFE
(() => {
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

  // Continuously update the cropped feed canvas
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

    // Process the drawn image to remove color data and isolate text.
    // Convert the image to grayscale then apply thresholding to create a binary (black & white) image.
    const imageData = croppedCtx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Convert to grayscale using luminance formula.
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // Apply thresholding (adjust the threshold value to suit your needs)
      const threshold = 150;
      const binary = gray < threshold ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }
    croppedCtx.putImageData(imageData, 0, 0);
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
})();