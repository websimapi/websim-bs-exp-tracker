import { init as initCapture, getCroppedCanvas } from "./capture.js";
import { initOCR } from "./ocr.js";
import { initSkillEvents, addSkillReading, archiveData, renderJournalDataUI, clearJournalData, exportJournalData, importJournalData } from "./skill.js";

window.addEventListener("DOMContentLoaded", () => {
  const captureBtn = document.getElementById("capture-btn");
  const videoElement = document.getElementById("capture-video");
  const cropBtn = document.getElementById("crop-btn");
  const resetCropBtn = document.getElementById("reset-crop-btn");
  const displayContainer = document.getElementById("display-container");
  const cropOverlay = document.getElementById("crop-overlay");
  const croppedCanvas = document.getElementById("cropped-canvas");
  
  const skillSelect = document.getElementById("skill-select");
  const resetExpBtn = document.getElementById("reset-exp-btn");
  const clearOcrBtn = document.getElementById("clear-ocr-btn");
  const ocrResultsContainer = document.getElementById("ocr-results-container");
  const expRateDiv = document.getElementById("exp-rate");
  const totalExpDiv = document.getElementById("total-exp");
  
  const archiveBtn = document.getElementById("archive-btn");
  const viewJournalBtn = document.getElementById("view-journal-btn");
  const clearArchivesBtn = document.getElementById("clear-archives-btn"); 
  const journalModal = document.getElementById("journal-modal");
  const journalEntries = document.getElementById("journal-entries");
  const modalClose = document.querySelector(".modal-close");

  const exportArchiveBtn = document.getElementById("export-archive-btn");
  const importArchiveBtn = document.getElementById("import-archive-btn");
  const importFileInput = document.getElementById("import-file-input");

  initCapture({
    captureBtn,
    videoElement,
    cropBtn,
    resetCropBtn,
    displayContainer,
    cropOverlay,
    croppedCanvas
  });

  initSkillEvents({
    skillSelect,
    resetExpBtn,
    clearOcrBtn,
    ocrResultsContainer,
    expRateDiv,
    totalExpDiv
  });

  initOCR(getCroppedCanvas, (newNumber) => {
    addSkillReading(newNumber, expRateDiv, totalExpDiv, ocrResultsContainer);
  });
  
  archiveBtn.addEventListener("click", () => {
    archiveData(expRateDiv, totalExpDiv, ocrResultsContainer);
  });

  viewJournalBtn.addEventListener("click", () => {
    renderJournalDataUI(journalEntries);
    journalModal.style.display = "block";
  });

  clearArchivesBtn.addEventListener("click", () => {
    clearJournalData(journalEntries);
  });

  exportArchiveBtn.addEventListener("click", () => {
    const dataStr = exportJournalData();
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "archive_data.json";
    downloadLink.click();
    URL.revokeObjectURL(url);
  });

  importArchiveBtn.addEventListener("click", () => {
    importFileInput.value = "";
    importFileInput.click();
  });

  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileContent = e.target.result;
      let merge = false;
      if (!confirm("Press OK to override current archive data, or Cancel to merge with existing data.")) {
        merge = true;
      }
      const success = importJournalData(fileContent, merge);
      if (success) {
        alert("Archive data imported successfully.");
      } else {
        alert("Failed to import archive data. Please check the file format.");
      }
    };
    reader.readAsText(file);
  });

  modalClose.addEventListener("click", () => {
    journalModal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target == journalModal) {
      journalModal.style.display = "none";
    }
  });
});