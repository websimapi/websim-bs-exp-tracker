'use strict';

// Using IIFE to encapsulate module logic
(() => {
  const captureBtn = document.getElementById('capture-btn');
  const videoElement = document.getElementById('capture-video');

  // Check if getDisplayMedia is supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert('Screen Capture API is not supported in your browser.');
    captureBtn.disabled = true;
  }

  // Function to start screen capturing
  async function startCapture() {
    try {
      // Request media stream from the user (window, browser tab, etc.)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false // Change to true if audio is required and supported
      });

      // Set the video element source to the stream
      videoElement.srcObject = stream;

      // Optional: Listen for stream stop events to reset the video element
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing stopped');
        videoElement.srcObject = null;
      });
    } catch (err) {
      console.error("Error: " + err);
      alert("An error occurred while trying to capture the screen: " + err.message);
    }
  }

  // Bind event listener to the button
  captureBtn.addEventListener('click', () => {
    startCapture();
  });
})();