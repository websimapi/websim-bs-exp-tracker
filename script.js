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
  const resetExpBtn = document.getElementById('reset-exp-btn'); // Reset Exp Rate button
  const resetDailyExpBtn = document.getElementById('reset-daily-exp-btn'); // Reset Daily EXP button
  const toggleOCRBtn = document.getElementById('toggle-ocr-btn'); // Toggle OCR on/off

  let cropRegion = null; // { x, y, w, h } relative to the video element's displayed area
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let cropAnimationFrameID = null;
  
  // Global OCR and skill variables
  let previousOCRFrame = '';
  let ocrInProgress = false;
  let currentSkill = '';

  // OCR active flag (default true) stored in localStorage
  let ocrActive = localStorage.getItem('ocrActive');
  ocrActive = ocrActive === null ? true : (ocrActive === 'true');

  // Update OCR toggle button label based on state
  function updateOCRButtonLabel() {
    toggleOCRBtn.textContent = ocrActive ? "OCR: On" : "OCR: Off";
  }
  updateOCRButtonLabel();

  // Load data from Local Storage
  let skillData = loadSkillData();
  let expResetData = loadExpResetData();
  let dailyResetData = loadDailyResetData();
  cropRegion = loadCropRegion(); // Load saved cropRegion, if any

  // Remember last selected skill from localStorage
  const storedSkill = localStorage.getItem('currentSkill');
  if (storedSkill) {
    currentSkill = storedSkill;
    skillSelect.value = storedSkill;
  }

  // When a skill is selected, update current label and UI
  skillSelect.addEventListener('change', (e) => {
    currentSkill = e.target.value;
    // Store the current selected skill in localStorage
    localStorage.setItem('currentSkill', currentSkill);
    renderSkillDataUI();
    updateExpRate();
    updateDailyExp();
  });

  // Event listener for resetting the EXP Rate
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

  // Event listener for resetting the Daily EXP
  resetDailyExpBtn.addEventListener('click', () => {
    if (!currentSkill) {
      alert("Please select a skill first to reset Daily EXP!");
      return;
    }
    const readings = skillData[currentSkill];
    if (!readings || readings.length === 0) {
      alert("No readings available for selected skill to reset Daily EXP!");
      return;
    }
    const lastReading = readings[readings.length - 1];
    dailyResetData[currentSkill] = { baseline: lastReading.value, timestamp: lastReading.timestamp };
    saveDailyResetData();
    updateDailyExp();
  });

  // Toggle OCR on/off and store state in localStorage
  toggleOCRBtn.addEventListener('click', () => {
    ocrActive = !ocrActive;
    localStorage.setItem('ocrActive', ocrActive);
    updateOCRButtonLabel();
  });

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
    saveCropRegion(null);
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
    // Only allow selection if click is within video bounds
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
    const currentClientX = Math.min(Math.max(e.clientX, videoRect.left), videoRect.right);
    const currentClientY = Math.min(Math.max(e.clientY, videoRect.top), videoRect.bottom);
    const currentXRel = currentClientX - videoRect.left;
    const currentYRel = currentClientY - videoRect.top;
    const relX = Math.min(startX, currentXRel);
    const relY = Math.min(startY, currentYRel);
    const width = Math.abs(currentXRel - startX);
    const height = Math.abs(currentYRel - startY);
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
      saveCropRegion(cropRegion);
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
    cropAnimationFrameID = requestAnimationFrame(updateCroppedFeed);
  }

  // Reset crop selection on user request
  resetCropBtn.addEventListener('click', () => {
    cropRegion = null;
    saveCropRegion(null);
    cropOverlay.style.display = 'none';
    resetCropBtn.style.display = 'none';
    if (cropAnimationFrameID) {
      cancelAnimationFrame(cropAnimationFrameID);
      cropAnimationFrameID = null;
    }
    // Also reset OCR state so stale frames don't trigger OCR
    previousOCRFrame = '';
    displayContainer.addEventListener('mousedown', startCrop);
  });

  // Auto-detect frame changes and perform OCR on the cropped feed.
  async function autoOCRCheck() {
    if (!ocrActive) return;
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
    // Run OCR only if frame has changed and if not already processing OCR
    if (currentDataURL !== previousOCRFrame && !ocrInProgress) {
      previousOCRFrame = currentDataURL;
      ocrInProgress = true;
      console.log("New frame detected. Running OCR...");
      try {
        const { data: { text } } = await Tesseract.recognize(croppedCanvas, 'eng', {
          logger: m => console.log(m)
        });
        // Remove everything except numbers and an optional dot
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
              // Ignore reading if it's less than last recorded value
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

  // Calculate and update EXP rate for current skill using reset data if available
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

  // Update and display Daily EXP gain for current skill, using daily reset data if available
  function updateDailyExp() {
    const dailyExpDiv = document.getElementById("daily-exp");
    if (!currentSkill || !skillData[currentSkill] || skillData[currentSkill].length === 0) {
      dailyExpDiv.textContent = "Daily EXP: N/A";
      return;
    }
    let baselineTimestamp = new Date().setHours(0,0,0,0);
    let baselineValue = null;
    if (dailyResetData[currentSkill]) {
      // Use the later baseline between today start and daily reset timestamp
      baselineTimestamp = Math.max(baselineTimestamp, dailyResetData[currentSkill].timestamp);
      baselineValue = dailyResetData[currentSkill].baseline;
    }
    const readings = skillData[currentSkill].filter(r => r.timestamp >= baselineTimestamp);
    if (readings.length < 1) {
      dailyExpDiv.textContent = "Daily EXP: N/A";
      return;
    }
    // Use the first reading as baseline if daily reset is not set
    if (baselineValue === null) {
      baselineValue = readings[0].value;
    }
    const last = readings[readings.length - 1];
    const deltaExp = last.value - baselineValue;
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
        // Render the list in reverse order
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

  // Load skill data from localStorage
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
  
  // Save skill data to localStorage
  function saveSkillData() {
    localStorage.setItem("skillData", JSON.stringify(skillData));
  }
  
  // Load EXP reset data from localStorage
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
  
  // Save EXP reset data to localStorage
  function saveExpResetData() {
    localStorage.setItem("expResetData", JSON.stringify(expResetData));
  }

  // Load Daily EXP reset data from localStorage
  function loadDailyResetData() {
    const stored = localStorage.getItem("dailyResetData");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing dailyResetData from localStorage:", e);
      }
    }
    return {};
  }

  // Save Daily EXP reset data to localStorage
  function saveDailyResetData() {
    localStorage.setItem("dailyResetData", JSON.stringify(dailyResetData));
  }

  // Load crop region from localStorage and correctly position the crop overlay
  function loadCropRegion() {
    const stored = localStorage.getItem("cropRegion");
    if (stored) {
      try {
        const region = JSON.parse(stored);
        // Verify a valid region
        if (region && region.x != null && region.y != null && region.w && region.h) {
          // Calculate the absolute position for the crop overlay based on the current video position
          const containerRect = displayContainer.getBoundingClientRect();
          const videoRect = videoElement.getBoundingClientRect();
          const videoOffsetX = videoRect.left - containerRect.left;
          const videoOffsetY = videoRect.top - containerRect.top;
          cropOverlay.style.display = 'block';
          cropOverlay.style.left = (videoOffsetX + region.x) + 'px';
          cropOverlay.style.top = (videoOffsetY + region.y) + 'px';
          cropOverlay.style.width = region.w + 'px';
          cropOverlay.style.height = region.h + 'px';
          return region;
        }
      } catch (e) {
        console.error("Error parsing cropRegion from localStorage:", e);
      }
    }
    return null;
  }

  // Save crop region to localStorage (stores coordinates relative to the video element)
  function saveCropRegion(region) {
    if (region) {
      localStorage.setItem("cropRegion", JSON.stringify(region));
    } else {
      localStorage.removeItem("cropRegion");
    }
  }

  // Check for frame changes every second to trigger OCR if needed
  setInterval(autoOCRCheck, 1000);

  // Initial render of stored skill data in the UI
  renderSkillDataUI();
  // If a cropRegion was loaded from storage, start updating the cropped feed.
  if (cropRegion) {
    updateCroppedFeed();
  }
})();