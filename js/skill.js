"use strict";

let skillData = {};
let expResetData = {};
let currentSkill = "";

// Initialize skill events and UI
function initSkillEvents({ skillSelect, resetExpBtn, clearOcrBtn, ocrResultsContainer, expRateDiv, dailyExpDiv }) {
  // Load stored data
  skillData = loadSkillData();
  expResetData = loadExpResetData();
  renderSkillDataUI(ocrResultsContainer);
  updateExpRate(expRateDiv);
  updateDailyExp(dailyExpDiv);

  skillSelect.addEventListener("change", (e) => {
    currentSkill = e.target.value;
    renderSkillDataUI(ocrResultsContainer);
    updateExpRate(expRateDiv);
    updateDailyExp(dailyExpDiv);
  });

  resetExpBtn.addEventListener("click", () => {
    if (!currentSkill) {
      alert("Please select a skill first to reset Exp Rate!");
      return;
    }
    const readings = skillData[currentSkill] || [];
    if (readings.length === 0) {
      alert("No readings available for selected skill to reset Exp Rate!");
      return;
    }
    const lastReading = readings[readings.length - 1];
    expResetData[currentSkill] = { baseline: lastReading.value, timestamp: lastReading.timestamp };
    saveExpResetData();
    updateExpRate(expRateDiv);
  });

  clearOcrBtn.addEventListener("click", () => {
    if (!currentSkill) {
      alert("Please select a skill first to clear OCR list!");
      return;
    }
    if (confirm(`Are you sure you want to clear the OCR list for ${currentSkill}? This cannot be undone.`)) {
      skillData[currentSkill] = [];
      saveSkillData();
      renderSkillDataUI(ocrResultsContainer);
      updateExpRate(expRateDiv);
      updateDailyExp(dailyExpDiv);
    }
  });
}

function addSkillReading(newNumber, expRateDiv, dailyExpDiv, ocrResultsContainer) {
  if (!currentSkill) {
    console.log("No skill selected, ignoring OCR reading.");
    return;
  }
  if (!skillData[currentSkill]) {
    skillData[currentSkill] = [];
  }
  const readings = skillData[currentSkill];
  if (readings.length > 0 && newNumber < readings[readings.length - 1].value) {
    console.log("Ignored OCR reading, number is less than previous value.");
    return;
  }
  const now = Date.now();
  readings.push({ value: newNumber, timestamp: now });
  saveSkillData();
  renderSkillDataUI(ocrResultsContainer);
  updateExpRate(expRateDiv);
  updateDailyExp(dailyExpDiv);
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

function updateExpRate(expRateDiv) {
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

function updateDailyExp(dailyExpDiv) {
  if (!currentSkill || !skillData[currentSkill] || skillData[currentSkill].length === 0) {
    dailyExpDiv.textContent = "Daily EXP: N/A";
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

function renderSkillDataUI(ocrResultsContainer) {
  ocrResultsContainer.innerHTML = "";
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
      reversedReadings.forEach((reading) => {
        const li = document.createElement("li");
        li.textContent = reading.value + " (" + new Date(reading.timestamp).toLocaleTimeString() + ")";
        ul.appendChild(li);
      });
      groupDiv.appendChild(ul);
    }
    ocrResultsContainer.appendChild(groupDiv);
  }
}

// New functions for Journal / Archive

function loadJournalData() {
  const stored = localStorage.getItem("journalData");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing journalData from localStorage:", e);
    }
  }
  return {};
}

function saveJournalData(data) {
  localStorage.setItem("journalData", JSON.stringify(data));
}

function archiveTodayData(expRateDiv, dailyExpDiv, ocrResultsContainer) {
  if (!currentSkill) {
    alert("Please select a skill to archive.");
    return;
  }
  const readings = skillData[currentSkill] || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = today.getTime();
  const todaysReadings = readings.filter(r => r.timestamp >= startOfDay);
  if (todaysReadings.length === 0) {
    alert("No readings for today to archive.");
    return;
  }
  const firstVal = todaysReadings[0].value;
  const lastVal = todaysReadings[todaysReadings.length - 1].value;
  const dailyExp = lastVal - firstVal;
  const dateStr = new Date().toISOString().split('T')[0];
  let journalData = loadJournalData();
  if (!journalData[currentSkill]) {
    journalData[currentSkill] = [];
  }
  const alreadyArchived = journalData[currentSkill].find(entry => entry.date === dateStr);
  if (alreadyArchived) {
    alert("Today's data has already been archived for this skill.");
    return;
  }
  const journalEntry = {
    date: dateStr,
    readings: todaysReadings,
    dailyExp: dailyExp
  };
  journalData[currentSkill].push(journalEntry);
  saveJournalData(journalData);
  // Remove archived readings from active data (keep only readings before today)
  skillData[currentSkill] = readings.filter(r => r.timestamp < startOfDay);
  saveSkillData();
  renderSkillDataUI(ocrResultsContainer);
  updateExpRate(expRateDiv);
  updateDailyExp(dailyExpDiv);
  alert("Today's data archived successfully.");
}

function renderJournalDataUI(archiveContainer) {
  archiveContainer.innerHTML = "";
  if (!currentSkill) {
    archiveContainer.innerHTML = "<p>Please select a skill to view archived entries.</p>";
    return;
  }
  const journalData = loadJournalData();
  const entries = journalData[currentSkill] || [];
  if (entries.length === 0) {
    archiveContainer.innerHTML = "<p>No archived entries for " + currentSkill + ".</p>";
    return;
  }
  // Sort entries in descending order by date
  entries.sort((a, b) => b.date.localeCompare(a.date));
  entries.forEach(entry => {
    const entryDiv = document.createElement("div");
    entryDiv.className = "journal-entry";
    entryDiv.innerHTML = "<strong>Date:</strong> " + entry.date + "<br>" +
                         "<strong>Daily EXP:</strong> " + entry.dailyExp.toFixed(2) + "<br>" +
                         "<details><summary>Readings</summary><ul>" +
                         entry.readings.map(r => "<li>" + r.value + " (" + new Date(r.timestamp).toLocaleTimeString() + ")</li>").join("") +
                         "</ul></details>";
    archiveContainer.appendChild(entryDiv);
  });
}

function autoArchiveAll(expRateDiv, dailyExpDiv, ocrResultsContainer) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let journalData = loadJournalData();
  let updated = false;
  for (const skill in skillData) {
    if (!skillData[skill] || skillData[skill].length === 0) continue;
    const previousReadings = skillData[skill].filter(r => r.timestamp < startOfToday);
    if (previousReadings.length === 0) continue;
    const firstVal = previousReadings[0].value;
    const lastVal = previousReadings[previousReadings.length - 1].value;
    const dailyExp = lastVal - firstVal;
    // Use the date from the last reading as the journal date
    const dateStr = new Date(previousReadings[previousReadings.length - 1].timestamp).toISOString().split('T')[0];
    if (!journalData[skill]) journalData[skill] = [];
    const exists = journalData[skill].find(e => e.date === dateStr);
    if (exists) continue;
    const journalEntry = {
      date: dateStr,
      readings: previousReadings,
      dailyExp: dailyExp
    };
    journalData[skill].push(journalEntry);
    skillData[skill] = skillData[skill].filter(r => r.timestamp >= startOfToday);
    updated = true;
  }
  if (updated) {
    saveJournalData(journalData);
    saveSkillData();
    if (currentSkill) {
      renderSkillDataUI(document.getElementById("ocr-results-container"));
      updateExpRate(expRateDiv);
      updateDailyExp(dailyExpDiv);
    }
  }
}

export { initSkillEvents, addSkillReading, archiveTodayData, renderJournalDataUI, autoArchiveAll };