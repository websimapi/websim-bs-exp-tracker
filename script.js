'use strict';

// Encapsulate module logic in an IIFE
(() => {
  const captureBtn = document.getElementById('capture-btn');
  const videoElement = document.getElementById('capture-video');
  const cropBtn = document.getElementById('crop-btn');
  const resetCropBtn = document.getElementById('reset-crop-btn');
  const displayContainer = document.getElementById('display-container');
  const cropOverlay = document.getElementById('crop-overlay');
  const croppedCanvas = document.getElementById('cropped-canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  let cropRegion = null; // Stores the crop rectangle { x, y, w, h } in display container coordinates
  let isSelecting = false; // Flag for active selection
  let startX = 0;
  let startY = 0;
  let cropAnimationFrameID = null;

  // Function to start screen capturing
  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false // Change to true if audio is required and supported
      });
      videoElement.srcObject = stream;

      // Listen for stream stop events to reset the video element
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

  // Crop Region Selection Functionality

  // Activate crop selection mode when user clicks the crop button
  cropBtn.addEventListener('click', () => {
    // Clear any previous crop selection
    cropRegion = null;
    cropOverlay.style.display = 'none';
    resetCropBtn.style.display = 'none';
    // Enable cropping mode by listening for mousedown on the display container
    displayContainer.addEventListener('mousedown', startCrop);
    // Change cursor to indicate selection mode
    displayContainer.style.cursor = 'crosshair';
  });

  // Handler for mousedown event to begin crop selection
  function startCrop(e) {
    if (!videoElement.srcObject) return;
    isSelecting = true;
    const containerRect = displayContainer.getBoundingClientRect();
    startX = e.clientX - containerRect.left;
    startY = e.clientY - containerRect.top;
    // Initialize crop overlay at the starting position
    cropOverlay.style.display = 'block';
    cropOverlay.style.left = startX + 'px';
    cropOverlay.style.top = startY + 'px';
    cropOverlay.style.width = '0px';
    cropOverlay.style.height = '0px';
    // Add listeners for mousemove and mouseup on document
    document.addEventListener('mousemove', onCropMove);
    document.addEventListener('mouseup', endCrop);
    // Remove mousedown listener from container for clean execution
    displayContainer.removeEventListener('mousedown', startCrop);
  }

  // Update function to adjust the crop overlay during mouse move
  function onCropMove(e) {
    if (!isSelecting) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const currentX = e.clientX - containerRect.left;
    const currentY = e.clientY - containerRect.top;
    const rectLeft = Math.min(startX, currentX);
    const rectTop = Math.min(startY, currentY);
    const rectWidth = Math.abs(currentX - startX);
    const rectHeight = Math.abs(currentY - startY);
    // Update the overlay style to visualize the crop selection area
    cropOverlay.style.left = rectLeft + 'px';
    cropOverlay.style.top = rectTop + 'px';
    cropOverlay.style.width = rectWidth + 'px';
    cropOverlay.style.height = rectHeight + 'px';
  }

  // Finalize crop region when mouse button is released
  function endCrop(e) {
    if (!isSelecting) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const endX = e.clientX - containerRect.left;
    const endY = e.clientY - containerRect.top;
    const rectLeft = Math.min(startX, endX);
    const rectTop = Math.min(startY, endY);
    const rectWidth = Math.abs(endX - startX);
    const rectHeight = Math.abs(endY - startY);
    // Only set cropRegion if selection has a significant size
    if (rectWidth > 10 && rectHeight > 10) {
      cropRegion = {
        x: rectLeft,
        y: rectTop,
        w: rectWidth,
        h: rectHeight
      };
      // Show the Reset Crop button so the user may clear the current crop region
      resetCropBtn.style.display = 'inline-block';
      // Start the cropped feed update loop if not already active
      if (!cropAnimationFrameID) {
        updateCroppedFeed();
      }
    } else {
      // If selection is too small, cancel the cropping overlay
      cropOverlay.style.display = 'none';
    }
    isSelecting = false;
    document.removeEventListener('mousemove', onCropMove);
    document.removeEventListener('mouseup', endCrop);
    // Reset cursor style
    displayContainer.style.cursor = 'default';
  }

  // Function to update the cropped feed continuously
  function updateCroppedFeed() {
    if (!cropRegion || !videoElement.srcObject) {
      // Clear the canvas if no crop region is defined
      croppedCtx.clearRect(0, 0, croppedCanvas.width, croppedCanvas.height);
      cropAnimationFrameID = null;
      return;
    }
    // Get the container's bounding rectangle to compute scaling factors
    const containerRect = displayContainer.getBoundingClientRect();
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    // Calculate scale factors (assumes the video fits the container)
    const scaleX = videoWidth / containerRect.width;
    const scaleY = videoHeight / containerRect.height;
    // Determine the corresponding coordinates within the video stream
    const videoCropX = cropRegion.x * scaleX;
    const videoCropY = cropRegion.y * scaleY;
    const videoCropWidth = cropRegion.w * scaleX;
    const videoCropHeight = cropRegion.h * scaleY;
    // Set the canvas dimensions to match the crop region (in container pixels)
    croppedCanvas.width = cropRegion.w;
    croppedCanvas.height = cropRegion.h;
    // Draw the cropped part of the video onto the canvas
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
    cropAnimationFrameID = requestAnimationFrame(updateCroppedFeed);
  }

  // Allow the user to reset the crop selection
  resetCropBtn.addEventListener('click', () => {
    cropRegion = null;
    cropOverlay.style.display = 'none';
    resetCropBtn.style.display = 'none';
    if (cropAnimationFrameID) {
      cancelAnimationFrame(cropAnimationFrameID);
      cropAnimationFrameID = null;
    }
    // Re-enable crop selection mode by re-attaching the mousedown listener
    displayContainer.addEventListener('mousedown', startCrop);
  });
})();