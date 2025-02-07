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
  const resetExpBtn = document.getElementById('reset-exp-btn'); 
  const clearDailyExpBtn = document.getElementById('clear-daily-exp-btn'); 
  
  let cropRegion = null; 
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let cropAnimationFrameID = null;
  
  let previousOCRFrame = '';
  let ocrInProgress = false;
  let currentSkill = '';

  let skillData = loadSkillData();
  let expResetData = loadExpResetData();
  let dailyResetData = loadDailyResetData();

  skillSelect.addEventListener('change', (e) => {
    currentSkill = e.target.value;
    renderSkillDataUI();
    updateExpRate();
    updateDailyExp();
  });

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
  
  clearDailyExpBtn.addEventListener('click', () => {
    if (!currentSkill) {
      alert("Please select a skill first to clear Daily EXP!");
      return;
    }
    const readings = skillData[currentSkill];
    if (!readings || readings.length === 0) {
      alert("No readings available for the selected skill.");
      return;
    }
    const lastReading = readings[readings.length - 1];
    dailyResetData[currentSkill] = { baseline: lastReading.value, timestamp: lastReading.timestamp };
    saveDailyResetData();
    updateDailyExp();
  });

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

  cropBtn.addEventListener('click', () => {
    cropRegion = null;
    cropOverlay.style.display = 'none';
    resetCropBtn.style.display = 'none';
    displayContainer.addEventListener('mousedown', startCrop);
    displayContainer.style.cursor = 'crosshair';
  });

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
    cropOverlay.style.display = 'block';
    cropOverlay.style.left = (videoOffsetX + startX) + 'px';
    cropOverlay.style.top = (videoOffsetY + startY) + 'px';
    cropOverlay.style.width = '0px';
    cropOverlay.style.height = '0px';

    document.addEventListener('mousemove', onCropMove);
    document.addEventListener('mouseup', endCrop);
    displayContainer.removeEventListener('mousedown', startCrop);
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
    cropOverlay.style.left = (videoOffsetX + relX) + 'px';
    cropOverlay.style.top = (videoOffsetY + relY) + 'px';
    cropOverlay.style.width = width + 'px';
    cropOverlay.style.height = height + 'px';
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

  resetCropBtn.addEventListener('click', () => {
    cropRegion = null;
    cropOverlay.style.display = 'none';
    resetCropBtn.style.display = 'none';
    if (cropAnimationFrameID) {
      cancelAnimationFrame(cropAnimationFrameID);
      cropAnimationFrameID = null;
    }
    previousOCRFrame = '';
    displayContainer.addEventListener('mousedown', startCrop);
  });

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
    if (currentDataURL !== previousOCRFrame && !ocrInProgress) {
      previousOCRFrame = currentDataURL;
      ocrInProgress = true;
      console.log("New frame detected. Running OCR...");
      try {
        const { data: { text } } = await Tesseract.recognize(croppedCanvas, 'eng', {
          logger: m => console.log(m)
        });
        const numbersOnly = text.replace(/[^0-9.]/g, '').trim();
        if (numbersOnly) {
          const newNumber = parseFloat(numbersOnly);
          if (isNaN(newNumber)) {
            console.log("OCR result is not a valid number.");
          } else {
            if (!currentSkill) {
              console.log("No skill selected, ignoring OCR reading.");
            } else {
              if (!skillData[currentSkill]) {
                skillData[currentSkill] = [];
              }
              const readings = skillData[currentSkill];
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

  function updateDailyExp() {
    const dailyExpDiv = document.getElementById("daily-exp");
    if (!currentSkill || !skillData[currentSkill] || skillData[currentSkill].length === 0) {
      dailyExpDiv.textContent = "Daily EXP: N/A";
      return;
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    let baselineTimestamp = today.getTime();
    if (dailyResetData[currentSkill]) {
      baselineTimestamp = dailyResetData[currentSkill].timestamp;
    }
    const readingsToday = skillData[currentSkill].filter(r => r.timestamp >= baselineTimestamp);
    if (readingsToday.length < 2) {
      dailyExpDiv.textContent = "Daily EXP: N/A";
      return;
    }
    const first = readingsToday[0];
    const last = readingsToday[readingsToday.length - 1];
    const deltaExp = last.value - first.value;
    dailyExpDiv.textContent = "Daily EXP (" + currentSkill + "): " + deltaExp.toFixed(2);
  }

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
  
  function saveSkillData() {
    localStorage.setItem("skillData", JSON.stringify(skillData));
  }
  
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
  
  function saveExpResetData() {
    localStorage.setItem("expResetData", JSON.stringify(expResetData));
  }
  
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
  
  function saveDailyResetData() {
    localStorage.setItem("dailyResetData", JSON.stringify(dailyResetData));
  }

  setInterval(autoOCRCheck, 1000);

  renderSkillDataUI();
})();