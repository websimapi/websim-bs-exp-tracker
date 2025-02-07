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
  const skillSelect = document.getElementById('skill-select');
  const resetExpBtn = document.getElementById('reset-exp-btn'); // New button for resetting EXP rate
  
  let cropRegion = null; // { x, y, w, h } relative to the video element's displayed area
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let cropAnimationFrameID = null;
  
  // Global variables for OCR and current label
  let previousOCRFrame = '';
  let ocrInProgress = false;
  let currentSkill = '';

  // Load skill data from Local Storage
  let skillData = loadSkillData();
  // Load exp reset data from Local Storage (for resetting xp/hr calculations)
  let expResetData = loadExpResetData();
  // Load persisted cropRegion from Local Storage
  cropRegion = loadCropRegion();

  // When the user selects a skill, update the current label and UI
  skillSelect.addEventListener('change', (e) => {
    currentSkill = e.target.value;
    renderSkillDataUI();
    updateExpRate();
    updateDailyExp();
  });

  // Event listener for resetting the EXP Rate (new feature)
  resetExpBtn.addEventListener('click', () => {
    if (!currentSkill) {
      alert("Please select a skill first to reset Exp Rate!");
      return;
    }
    const readings = skillData[currentSkill];
    if (!readings || readings.length === 0) {
      alert("No readings available for selected skill to reset Exp Rate!");
      return;
    }
    const lastReading = readings[readings.length - 1];
    expResetData[currentSkill] = { baseline: lastReading.value, timestamp: lastReading.timestamp };
    saveExpResetData();
    updateExpRate();
  });

  // Start screen capture
  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      videoElement.srcObject = stream;
      // Ensure the video starts playing (this helps trigger loadedmetadata)
      await videoElement.play();
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
    hideCropOverlay();
    resetCropBtn.style.display = 'none';
    displayContainer.addEventListener('mousedown', startCrop);
    displayContainer.style.cursor = 'crosshair';
  });

  // Begin crop selection
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
      // Persist cropRegion details to Local Storage
      localStorage.setItem("cropRegion", JSON.stringify(cropRegion));
      resetCropBtn.style.display = 'inline-block';
      if (!cropAnimationFrameID) {
        updateCroppedFeed();
      }
    } else {
      hideCropOverlay();
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
    // Ensure video dimensions are available
    if (videoRect.width === 0 || videoRect.height === 0 || !videoElement.videoWidth || !videoElement.videoHeight) {
      cropAnimationFrameID = requestAnimationFrame(updateCroppedFeed);
      return;
    }
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

  // Reset crop selection on user request
  resetCropBtn.addEventListener('click', () => {
    cropRegion = null;
    hideCropOverlay();
    resetCropBtn.style.display = 'none';
    localStorage.removeItem("cropRegion");
    if (cropAnimationFrameID) {
      cancelAnimationFrame(cropAnimationFrameID);
      cropAnimationFrameID = null;
    }
    // Also reset OCR detection data so it doesn't trigger on stale frames
    previousOCRFrame = '';
    displayContainer.addEventListener('mousedown', startCrop);
  });

  // Auto-detect frame changes and perform OCR on the cropped feed.
  async function autoOCRCheck() {
    if (!cropRegion || !videoElement.srcObject) {
      croppedCtx.clearRect(0, 0, croppedCanvas.width, croppedCanvas.height);
      return;
    }
    let currentDataURL;
    try {
      currentDataURL = croppedCanvas.toDataURL('image/png');
    } catch (e) {
      return;
    }
    // Run OCR only if a new frame is detected and if not already processing OCR
    if (currentDataURL !== previousOCRFrame && !ocrInProgress) {
      previousOCRFrame = currentDataURL;
      ocrInProgress = true;
      console.log("New frame detected. Running OCR...");
      try {
        const { data: { text } } = await Tesseract.recognize(croppedCanvas, 'eng', {
          logger: m => console.log(m)
        });
        // Remove everything except numbers and optional dot
        const numbersOnly = text.replace(/[^0-9.]/g, '').trim();
        if (numbersOnly) {
          const newNumber = parseFloat(numbersOnly);
          if (isNaN(newNumber)) {
            console.log("OCR result is not a valid number.");
          } else {
            // Only record if a skill is selected
            if (!currentSkill) {
              console.log("No skill selected, ignoring OCR reading.");
            } else {
              if (!skillData[currentSkill]) {
                skillData[currentSkill] = [];
              }
              const readings = skillData[currentSkill];
              // Ignore the reading if it is less than the last recorded value
              if (readings.length > 0 && newNumber < readings[readings.length - 1].value) {
                console.log("Ignored OCR reading, number is less than previous value.");
              } else {
                const now = new Date();
                readings.push({ value: newNumber, timestamp: now.getTime() });
                saveSkillData();
                renderSkillDataUI();
                updateExpRate();
                updateDailyExp();
              }
            }
          }
        }
      } catch (err) {
        console.error('OCR error:', err);
      } finally {
        ocrInProgress = false;
      }
    }
  }

  // Calculate and update experience gain rate for the current skill using reset data if available
  function updateExpRate() {
    const expRateDiv = document.getElementById("exp-rate");
    if (!currentSkill || !skillData[currentSkill] || skillData[currentSkill].length < 2) {
      expRateDiv.textContent = "Exp Rate: N/A";
      return;
    }
    const readings = skillData[currentSkill];
    let startReading = readings[0];
    if (expResetData[currentSkill]) {
      const resetTimestamp = expResetData[currentSkill].timestamp;
      const postResetReadings = readings.filter(r => r.timestamp >= resetTimestamp);
      if (postResetReadings.length > 0) {
        startReading = postResetReadings[0];
      } else {
        startReading = { value: expResetData[currentSkill].baseline, timestamp: expResetData[currentSkill].timestamp };
      }
    }
    const lastReading = readings[readings.length - 1];
    const deltaExp = lastReading.value - startReading.value;
    const deltaTimeMs = lastReading.timestamp - startReading.timestamp;
    if (deltaTimeMs <= 0) {
      expRateDiv.textContent = "Exp Rate: N/A";
      return;
    }
    const deltaHours = deltaTimeMs / (3600 * 1000);
    const expRate = deltaExp / deltaHours;
    expRateDiv.textContent = "Exp Rate (" + currentSkill + "): " + expRate.toFixed(2) + " xp/h";
  }

  // Update and display daily EXP gain for the current skill
  function updateDailyExp() {
    const dailyExpDiv = document.getElementById("daily-exp");
    if (!currentSkill || !skillData[currentSkill] || skillData[currentSkill].length === 0) {
      dailyExpDiv.textContent = "Daily EXP: N/A";
      return;
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfDay = today.getTime();
    const readingsToday = skillData[currentSkill].filter(r => r.timestamp >= startOfDay);
    if (readingsToday.length < 2) {
      dailyExpDiv.textContent = "Daily EXP: N/A";
      return;
    }
    const first = readingsToday[0];
    const last = readingsToday[readingsToday.length - 1];
    const deltaExp = last.value - first.value;
    dailyExpDiv.textContent = "Daily EXP (" + currentSkill + "): " + deltaExp.toFixed(2);
  }

  // Render the OCR readings grouped by skill from Local Storage in reverse order
  function renderSkillDataUI() {
    const container = document.getElementById("ocr-results-container");
    container.innerHTML = "";
    for (const skill in skillData) {
      const groupDiv = document.createElement("div");
      groupDiv.className = "skill-group";
      const header = document.createElement("h3");
      header.textContent = skill;
      groupDiv.appendChild(header);
      if (skillData[skill].length === 0) {
        const p = document.createElement("p");
        p.textContent = "No readings yet.";
        groupDiv.appendChild(p);
      } else {
        const ul = document.createElement("ul");
        // Render the list in reverse order without changing the math/calculations
        const reversedReadings = skillData[skill].slice().reverse();
        reversedReadings.forEach(reading => {
          const li = document.createElement("li");
          li.textContent = reading.value + " (" + new Date(reading.timestamp).toLocaleTimeString() + ")";
          ul.appendChild(li);
        });
        groupDiv.appendChild(ul);
      }
      container.appendChild(groupDiv);
    }
  }

  // Load skill data from local storage
  function loadSkillData() {
    const stored = localStorage.getItem("skillData");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing skillData from localStorage:", e);
      }
    }
    return {};
  }
  
  // Save skill data to local storage
  function saveSkillData() {
    localStorage.setItem("skillData", JSON.stringify(skillData));
  }
  
  // Load exp reset data from local storage
  function loadExpResetData() {
    const stored = localStorage.getItem("expResetData");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing expResetData from localStorage:", e);
      }
    }
    return {};
  }
  
  // Save exp reset data to local storage
  function saveExpResetData() {
    localStorage.setItem("expResetData", JSON.stringify(expResetData));
  }

  // Load cropRegion data from local storage
  function loadCropRegion() {
    const stored = localStorage.getItem("cropRegion");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing cropRegion from localStorage:", e);
      }
    }
    return null;
  }

  // Update crop overlay visual based on cropRegion data
  function updateCropOverlayDisplay() {
    if (!cropRegion) return;
    const containerRect = displayContainer.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();
    const videoOffsetX = videoRect.left - containerRect.left;
    const videoOffsetY = videoRect.top - containerRect.top;
    cropOverlay.style.display = 'block';
    cropOverlay.style.left = (videoOffsetX + cropRegion.x) + 'px';
    cropOverlay.style.top = (videoOffsetY + cropRegion.y) + 'px';
    cropOverlay.style.width = cropRegion.w + 'px';
    cropOverlay.style.height = cropRegion.h + 'px';
  }

  // Hide crop overlay
  function hideCropOverlay() {
    cropOverlay.style.display = 'none';
  }

  // Check for frame changes every second to trigger OCR if needed
  setInterval(autoOCRCheck, 1000);

  // When video metadata is loaded, if there's a stored cropRegion, update the overlay and start cropped feed
  videoElement.addEventListener('loadedmetadata', () => {
    if (cropRegion) {
      updateCropOverlayDisplay();
      if (!cropAnimationFrameID) {
        updateCroppedFeed();
      }
    }
  });

  // Initial render of stored skill data in the UI
  renderSkillDataUI();
})();