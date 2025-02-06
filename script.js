'use strict';

(() => {
  const captureBtn = document.getElementById('capture-btn');
  const selectCropBtn = document.getElementById('select-crop-btn');
  const applyCropBtn = document.getElementById('apply-crop-btn');
  const resetBtn = document.getElementById('reset-btn');
  const videoElement = document.getElementById('capture-video');
  const croppedCanvas = document.getElementById('cropped-canvas');
  const cropOverlay = document.getElementById('crop-overlay');
  const displayContainer = document.getElementById('display-container');

  let stream = null;
  let captureAnimationFrame = null;
  let cropRect = null; // { x, y, width, height } relative to displayContainer
  let selectionInProgress = false;
  let startX = 0;
  let startY = 0;

  // Check if getDisplayMedia is supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert('Screen Capture API is not supported in your browser.');
    captureBtn.disabled = true;
  }

  async function startCapture() {
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      videoElement.srcObject = stream;
      videoElement.play();

      // enable cropping buttons now that capture is active
      selectCropBtn.disabled = false;
      resetBtn.disabled = false;

      // Listen for stream stop events to reset the video element
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing stopped');
        videoElement.srcObject = null;
        selectCropBtn.disabled = true;
        applyCropBtn.disabled = true;
        resetBtn.disabled = true;
      });
    } catch (err) {
      console.error("Error: " + err);
      alert("An error occurred while trying to capture the screen: " + err.message);
    }
  }

  // Function to update the cropped canvas with the current video frame cropped to cropRect
  function updateCroppedCanvas() {
    if (!cropRect) return;
    const ctx = croppedCanvas.getContext('2d');

    // Calculate scaling factor between video display size and actual recorded video size
    const videoDisplayWidth = videoElement.offsetWidth;
    const videoDisplayHeight = videoElement.offsetHeight;
    const scaleX = videoElement.videoWidth / videoDisplayWidth;
    const scaleY = videoElement.videoHeight / videoDisplayHeight;

    // Set canvas dimensions equal to cropRect (in video coordinate space)
    const videoCropX = cropRect.x * scaleX;
    const videoCropY = cropRect.y * scaleY;
    const videoCropWidth = cropRect.width * scaleX;
    const videoCropHeight = cropRect.height * scaleY;
    
    croppedCanvas.width = cropRect.width;
    croppedCanvas.height = cropRect.height;

    // Draw the corresponding portion of the video onto the canvas, scaling down to canvas size
    ctx.drawImage(
      videoElement,
      videoCropX, videoCropY, videoCropWidth, videoCropHeight,
      0, 0, cropRect.width, cropRect.height
    );
    // Continue updating if stream is live
    captureAnimationFrame = requestAnimationFrame(updateCroppedCanvas);
  }

  // Enable user to select crop region on the display container
  function enableCropSelection() {
    cropOverlay.hidden = false;
    cropOverlay.style.left = '0px';
    cropOverlay.style.top = '0px';
    cropOverlay.style.width = '0px';
    cropOverlay.style.height = '0px';
    cropRect = null;
    selectionInProgress = false;

    displayContainer.addEventListener('mousedown', startSelection);
    displayContainer.addEventListener('mousemove', updateSelection);
    displayContainer.addEventListener('mouseup', finishSelection);
    // Ensure touch events work too
    displayContainer.addEventListener('touchstart', startSelection);
    displayContainer.addEventListener('touchmove', updateSelection);
    displayContainer.addEventListener('touchend', finishSelection);
  }

  function disableCropSelection() {
    cropOverlay.hidden = true;
    displayContainer.removeEventListener('mousedown', startSelection);
    displayContainer.removeEventListener('mousemove', updateSelection);
    displayContainer.removeEventListener('mouseup', finishSelection);
    displayContainer.removeEventListener('touchstart', startSelection);
    displayContainer.removeEventListener('touchmove', updateSelection);
    displayContainer.removeEventListener('touchend', finishSelection);
  }

  function getPointerEvent(evt) {
    return evt.touches ? evt.touches[0] : evt;
  }

  function startSelection(evt) {
    evt.preventDefault();
    const pointer = getPointerEvent(evt);
    const rect = displayContainer.getBoundingClientRect();
    startX = pointer.clientX - rect.left;
    startY = pointer.clientY - rect.top;
    cropOverlay.style.left = startX + 'px';
    cropOverlay.style.top = startY + 'px';
    cropOverlay.style.width = '0px';
    cropOverlay.style.height = '0px';
    selectionInProgress = true;
  }

  function updateSelection(evt) {
    if (!selectionInProgress) return;
    evt.preventDefault();
    const pointer = getPointerEvent(evt);
    const rect = displayContainer.getBoundingClientRect();
    const currentX = pointer.clientX - rect.left;
    const currentY = pointer.clientY - rect.top;
    const x = Math.min(currentX, startX);
    const y = Math.min(currentY, startY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    cropOverlay.style.left = x + 'px';
    cropOverlay.style.top = y + 'px';
    cropOverlay.style.width = width + 'px';
    cropOverlay.style.height = height + 'px';
  }

  function finishSelection(evt) {
    if (!selectionInProgress) return;
    evt.preventDefault();
    const pointer = getPointerEvent(evt);
    const rect = displayContainer.getBoundingClientRect();
    const endX = pointer.clientX - rect.left;
    const endY = pointer.clientY - rect.top;
    const x = Math.min(endX, startX);
    const y = Math.min(endY, startY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    cropRect = { x, y, width, height };
    selectionInProgress = false;
    disableCropSelection();
    applyCropBtn.disabled = false;
  }

  selectCropBtn.addEventListener('click', () => {
    // Enable crop selection only if video is visible and streaming
    if (!videoElement.srcObject) return;
    // Reset any previous crop
    cropRect = null;
    applyCropBtn.disabled = true;
    // Enable selection mode and show instructions by enabling the overlay
    enableCropSelection();
  });

  applyCropBtn.addEventListener('click', () => {
    if (!cropRect) {
      alert("Please select a crop region first.");
      return;
    }
    // Hide the video element and show the canvas with cropped region
    videoElement.style.display = 'none';
    croppedCanvas.style.display = 'block';
    // Start updating the canvas continuously
    updateCroppedCanvas();
    // Disable crop selection buttons until reset
    selectCropBtn.disabled = true;
    applyCropBtn.disabled = true;
  });

  resetBtn.addEventListener('click', () => {
    // Reset to original video view
    if (captureAnimationFrame) {
      cancelAnimationFrame(captureAnimationFrame);
      captureAnimationFrame = null;
    }
    croppedCanvas.style.display = 'none';
    videoElement.style.display = 'block';
    // Reset crop rectangle and re-enable crop selection
    cropRect = null;
    selectCropBtn.disabled = false;
    applyCropBtn.disabled = true;
  });

  // Bind event listener for start capture button
  captureBtn.addEventListener('click', () => {
    startCapture();
  });
})();