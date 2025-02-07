import { init as initCapture, getCroppedCanvas } from "./capture.js";
import { initOCR } from "./ocr.js";
import {
  initSkillEvents,
  addSkillReading,
  archiveTodayDataAll,
  archiveSelectedSkillData,
  renderJournalDataUI,
  autoArchiveAll
} from "./skill.js";

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
  
  // Archive buttons and modal elements
  const archiveBtn = document.getElementById("archive-btn");
  const archiveSkillBtn = document.getElementById("archive-skill-btn");
  const viewJournalBtn = document.getElementById("view-journal-btn");
  const journalModal = document.getElementById("journal-modal");
  const journalEntries = document.getElementById("journal-entries");
  const modalClose = document.querySelector(".modal-close");

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
  
  // Countdown Timer for reset at 00:00
  function updateCountdown() {
    const countdownEl = document.getElementById("time-till-reset");
    if (!countdownEl) return;
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const diff = tomorrow - now; // in milliseconds
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    countdownEl.textContent = `Time till reset: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  
  setInterval(updateCountdown, 1000);
  updateCountdown();

  // Archive Buttons events
  // Archive All Skills
  archiveBtn.addEventListener("click", () => {
    archiveTodayDataAll(expRateDiv, dailyExpDiv, ocrResultsContainer);
  });
  // Archive only the selected skill
  archiveSkillBtn.addEventListener("click", () => {
    archiveSelectedSkillData(expRateDiv, dailyExpDiv, ocrResultsContainer);
  });

  // View Archived Journal button event - open modal and render journal entries
  viewJournalBtn.addEventListener("click", () => {
    renderJournalDataUI(journalEntries);
    journalModal.style.display = "block";
  });

  // Modal close event
  modalClose.addEventListener("click", () => {
    journalModal.style.display = "none";
  });

  // Click outside modal content to close
  window.addEventListener("click", (event) => {
    if (event.target == journalModal) {
      journalModal.style.display = "none";
    }
  });

  // Schedule auto archive at midnight (daily EXP reset)
  function scheduleAutoArchive() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = nextMidnight - now;
    setTimeout(() => {
      autoArchiveAll(expRateDiv, dailyExpDiv, ocrResultsContainer);
      scheduleAutoArchive();
    }, delay);
  }
  scheduleAutoArchive();
});