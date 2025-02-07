import { init as initCapture, getCroppedCanvas } from "./capture.js";
import { initOCR } from "./ocr.js";
import { initSkillEvents, addSkillReading } from "./skill.js";

window.addEventListener("DOMContentLoaded", () => {
  // Grab necessary DOM elements
  const captureBtn = document.getElementById("capture-btn");
  const videoElement = document.getElementById("capture-video");
  const cropBtn = document.getElementById("crop-btn");
  const resetCropBtn = document.getElementById("reset-crop-btn");
  const displayContainer = document.getElementById("display-container");
  const cropOverlay = document.getElementById("crop-overlay");
  const croppedCanvas = document.getElementById("cropped-canvas");
  
  // Skill UI elements
  const skillSelect = document.getElementById("skill-select");
  const resetExpBtn = document.getElementById("reset-exp-btn");
  const clearOcrBtn = document.getElementById("clear-ocr-btn");
  const ocrResultsContainer = document.getElementById("ocr-results-container");
  const expRateDiv = document.getElementById("exp-rate");
  const dailyExpDiv = document.getElementById("daily-exp");

  // Initialize the capture module (screen capture, crop selection & cropped feed update)
  initCapture({
    captureBtn,
    videoElement,
    cropBtn,
    resetCropBtn,
    displayContainer,
    cropOverlay,
    croppedCanvas
  });

  // Initialize skill data & UI events
  initSkillEvents({
    skillSelect,
    resetExpBtn,
    clearOcrBtn,
    ocrResultsContainer,
    expRateDiv,
    dailyExpDiv
  });

  // Initialize OCR processing – runs every second if a new frame is detected.
  initOCR(getCroppedCanvas, (newNumber) => {
    addSkillReading(newNumber, expRateDiv, dailyExpDiv, ocrResultsContainer);
  });
});