"use strict";

let previousOCRFrame = "";
let ocrInProgress = false;

async function autoOCRCheck(canvas, onNewResult) {
  if (!canvas || canvas.width === 0 || !canvas.getContext) return;
  let currentDataURL;
  try {
    currentDataURL = canvas.toDataURL("image/png");
  } catch (e) {
    return;
  }
  if (currentDataURL === previousOCRFrame || ocrInProgress) return;
  previousOCRFrame = currentDataURL;
  ocrInProgress = true;
  console.log("New frame detected. Running OCR...");
  try {
    const { data: { text } } = await Tesseract.recognize(canvas, "eng", {
      logger: (m) => console.log(m)
    });
    // Remove everything except numbers and a dot
    const numbersOnly = text.replace(/[^0-9.]/g, "").trim();
    if (numbersOnly) {
      const newNumber = parseFloat(numbersOnly);
      if (isNaN(newNumber)) {
        console.log("OCR result is not a valid number:", numbersOnly);
      } else {
        onNewResult(newNumber);
      }
    }
  } catch (err) {
    console.error("OCR error:", err);
  } finally {
    ocrInProgress = false;
  }
}

function initOCR(getCroppedCanvas, onNewResult) {
  setInterval(() => {
    const canvas = getCroppedCanvas();
    autoOCRCheck(canvas, onNewResult);
  }, 1000);
}

export { initOCR };