"use strict";

let videoElement, displayContainer, cropOverlay, croppedCanvas, croppedCtx;
let cropRegion = null;
let isSelecting = false;
let startX = 0;
let startY = 0;
let cropAnimationFrameID = null;

function init(domElements) {
  const {
    captureBtn,
    videoElement: vidEl,
    cropBtn,
    resetCropBtn,
    displayContainer: dispContainer,
    cropOverlay: overlay,
    croppedCanvas: canvas
  } = domElements;

  videoElement = vidEl;
  displayContainer = dispContainer;
  cropOverlay = overlay;
  croppedCanvas = canvas;
  croppedCtx = croppedCanvas.getContext("2d");

  captureBtn.addEventListener("click", startCapture);
  cropBtn.addEventListener("click", enableCropSelection);
  resetCropBtn.addEventListener("click", resetCropSelection);
}

async function startCapture() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false,
    });
    videoElement.srcObject = stream;
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      const savedCrop = localStorage.getItem("savedCropRegion");
      if (savedCrop) {
        cropRegion = JSON.parse(savedCrop);
        const containerRect = displayContainer.getBoundingClientRect();
        const videoRect = videoElement.getBoundingClientRect();
        const videoOffsetX = videoRect.left - containerRect.left;
        const videoOffsetY = videoRect.top - containerRect.top;
        cropOverlay.style.display = "block";
        cropOverlay.style.left = (videoOffsetX + cropRegion.x) + "px";
        cropOverlay.style.top = (videoOffsetY + cropRegion.y) + "px";
        cropOverlay.style.width = cropRegion.w + "px";
        cropOverlay.style.height = cropRegion.h + "px";
        document.getElementById("reset-crop-btn").style.display = "inline-block";
        if (!cropAnimationFrameID) {
          updateCroppedFeed();
        }
      }
    };
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      console.log("Screen sharing stopped");
      videoElement.srcObject = null;
    });
  } catch (err) {
    console.error("Error: " + err);
    alert("An error occurred while trying to capture the screen: " + err.message);
  }
}

function enableCropSelection() {
  cropRegion = null;
  cropOverlay.style.display = "none";
  document.getElementById("reset-crop-btn").style.display = "none";
  displayContainer.addEventListener("mousedown", startCrop);
  displayContainer.style.cursor = "crosshair";
}

function startCrop(e) {
  if (!videoElement.srcObject) return;
  const containerRect = displayContainer.getBoundingClientRect();
  const videoRect = videoElement.getBoundingClientRect();
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
  const videoOffsetX = videoRect.left - containerRect.left;
  const videoOffsetY = videoRect.top - containerRect.top;
  cropOverlay.style.display = "block";
  cropOverlay.style.left = videoOffsetX + startX + "px";
  cropOverlay.style.top = videoOffsetY + startY + "px";
  cropOverlay.style.width = "0px";
  cropOverlay.style.height = "0px";

  document.addEventListener("mousemove", onCropMove);
  document.addEventListener("mouseup", endCrop);
  displayContainer.removeEventListener("mousedown", startCrop);
}

function onCropMove(e) {
  if (!isSelecting) return;
  const containerRect = displayContainer.getBoundingClientRect();
  const videoRect = videoElement.getBoundingClientRect();
  const videoOffsetX = videoRect.left - containerRect.left;
  const videoOffsetY = videoRect.top - containerRect.top;
  const currentClientX = Math.min(Math.max(e.clientX, videoRect.left), videoRect.right);
  const currentClientY = Math.min(Math.max(e.clientY, videoRect.top), videoRect.bottom);
  const currentXRel = currentClientX - videoRect.left;
  const currentYRel = currentClientY - videoRect.top;
  const relX = Math.min(startX, currentXRel);
  const relY = Math.min(startY, currentYRel);
  const width = Math.abs(currentXRel - startX);
  const height = Math.abs(currentYRel - startY);
  cropOverlay.style.left = videoOffsetX + relX + "px";
  cropOverlay.style.top = videoOffsetY + relY + "px";
  cropOverlay.style.width = width + "px";
  cropOverlay.style.height = height + "px";
}

function endCrop(e) {
  if (!isSelecting) return;
  const containerRect = displayContainer.getBoundingClientRect();
  const videoRect = videoElement.getBoundingClientRect();
  const videoOffsetX = videoRect.left - containerRect.left;
  const videoOffsetY = videoRect.top - containerRect.top;
  const endClientX = Math.min(Math.max(e.clientX, videoRect.left), videoRect.right);
  const endClientY = Math.min(Math.max(e.clientY, videoRect.top), videoRect.bottom);
  const endXRel = endClientX - videoRect.left;
  const endYRel = endClientY - videoRect.top;
  const rectLeft = Math.min(startX, endXRel);
  const rectTop = Math.min(startY, endYRel);
  const rectWidth = Math.abs(endXRel - startX);
  const rectHeight = Math.abs(endYRel - startY);

  if (rectWidth > 10 && rectHeight > 10) {
    cropRegion = { x: rectLeft, y: rectTop, w: rectWidth, h: rectHeight };
    document.getElementById("reset-crop-btn").style.display = "inline-block";
    localStorage.setItem("savedCropRegion", JSON.stringify(cropRegion));
    if (!cropAnimationFrameID) {
      updateCroppedFeed();
    }
  } else {
    cropOverlay.style.display = "none";
  }
  isSelecting = false;
  document.removeEventListener("mousemove", onCropMove);
  document.removeEventListener("mouseup", endCrop);
  displayContainer.addEventListener("mousedown", startCrop);
  displayContainer.style.cursor = "default";
}

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
  cropAnimationFrameID = requestAnimationFrame(updateCroppedFeed);
}

function resetCropSelection() {
  cropRegion = null;
  cropOverlay.style.display = "none";
  document.getElementById("reset-crop-btn").style.display = "none";
  localStorage.removeItem("savedCropRegion");
  if (cropAnimationFrameID) {
    cancelAnimationFrame(cropAnimationFrameID);
    cropAnimationFrameID = null;
  }
  displayContainer.addEventListener("mousedown", startCrop);
}

function getCroppedCanvas() {
  return croppedCanvas;
}

export { init, getCroppedCanvas };