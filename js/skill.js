"use strict";

let skillData = {};
let expResetData = {};
let currentSkill = "";

// Initialize skill events and UI
function initSkillEvents({ skillSelect, resetExpBtn, clearOcrBtn, ocrResultsContainer, expRateDiv, totalExpDiv }) {
  // Load stored data
  skillData = loadSkillData();
  expResetData = loadExpResetData();
  renderSkillDataUI(document.getElementById("ocr-results-container"));
  updateExpRate(expRateDiv);
  updateTotalExp(totalExpDiv);

  skillSelect.addEventListener("change", (e) => {
    currentSkill = e.target.value;
    // When a new skill is selected, no need for a button press—the label is set automatically.
    renderSkillDataUI(document.getElementById("ocr-results-container"));
    updateExpRate(expRateDiv);
    updateTotalExp(totalExpDiv);
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
    updateTotalExp(totalExpDiv);
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
      updateTotalExp(totalExpDiv);
    }
  });
}

function addSkillReading(newNumber, expRateDiv, totalExpDiv, ocrResultsContainer) {
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
  renderSkillDataUI(document.getElementById("ocr-results-container"));
  updateExpRate(expRateDiv);
  updateTotalExp(totalExpDiv);
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

function updateTotalExp(totalExpDiv) {
  if (!currentSkill || !skillData[currentSkill] || skillData[currentSkill].length === 0) {
    totalExpDiv.textContent = "Total Exp: N/A";
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
  totalExpDiv.textContent = "Total Exp (" + currentSkill + "): " + deltaExp.toFixed(2);
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
      // Render in reverse order
      const reversedReadings = skillData[skill].slice().reverse();
      reversedReadings.forEach((reading) => {
        const li = document.createElement("li");
        li.innerHTML = reading.value + " (" + new Date(reading.timestamp).toLocaleTimeString() + ") ";
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️";
        deleteBtn.className = "delete-reading";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Are you sure you want to delete this OCR reading?")) {
            // Remove the reading with matching timestamp
            skillData[skill] = skillData[skill].filter(r => r.timestamp !== reading.timestamp);
            saveSkillData();
            renderSkillDataUI(ocrResultsContainer);
            const expRateDiv = document.getElementById("exp-rate");
            const totalExpDiv = document.getElementById("total-exp");
            updateExpRate(expRateDiv);
            updateTotalExp(totalExpDiv);
          }
        });
        li.appendChild(deleteBtn);
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

function archiveData(expRateDiv, totalExpDiv, ocrResultsContainer) {
  if (!currentSkill) {
    alert("Please select a skill to archive.");
    return;
  }
  const readings = skillData[currentSkill] || [];
  if (readings.length === 0) {
    alert("No readings to archive.");
    return;
  }
  const firstVal = readings[0].value;
  const lastVal = readings[readings.length - 1].value;
  const totalExp = lastVal - firstVal;
  const dateStr = new Date().toISOString().split('T')[0];
  let journalData = loadJournalData();
  if (!journalData[currentSkill]) {
    journalData[currentSkill] = [];
  }
  // Allow multiple archives per day without blocking duplicates
  const journalEntry = {
    date: dateStr,
    skill: currentSkill,
    readings: readings,
    totalExp: totalExp
  };
  journalData[currentSkill].push(journalEntry);
  saveJournalData(journalData);
  // Clear active readings for this skill after archiving
  skillData[currentSkill] = [];
  saveSkillData();
  renderSkillDataUI(ocrResultsContainer);
  updateExpRate(expRateDiv);
  updateTotalExp(totalExpDiv);
  alert("Data archived successfully.");
}

function renderJournalDataUI(archiveContainer) {
  archiveContainer.innerHTML = "";
  const journalData = loadJournalData();
  let hasEntries = false;
  // Iterate over all skills in the journal data
  for (const skill in journalData) {
    const entries = journalData[skill];
    if (!entries || entries.length === 0) continue;
    hasEntries = true;
    // Create a container for this skill's journal entries
    const skillContainer = document.createElement("div");
    skillContainer.className = "journal-skill-group";
    const skillHeader = document.createElement("h3");
    skillHeader.textContent = "Skill: " + skill;
    skillContainer.appendChild(skillHeader);
    // Sort entries in descending order by date
    entries.sort((a, b) => b.date.localeCompare(a.date));
    entries.forEach(entry => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "journal-entry";
      entryDiv.innerHTML = `
        <div class="journal-entry-header">
          <span><strong>Date:</strong> ${entry.date}</span> |
          <span><strong>Total Exp:</strong> ${entry.totalExp.toFixed(2)}</span>
          <button class="delete-archive" data-skill="${skill}" data-date="${entry.date}">Delete</button>
        </div>
        <details class="journal-entry-details">
          <summary>Readings</summary>
          <ul>
            ${entry.readings?.map(r => `<li>${r.value} (${new Date(r.timestamp).toLocaleTimeString()})</li>`).join('') || '<li>No readings</li>'}
          </ul>
        </details>
      `;
      const deleteBtn = entryDiv.querySelector('.delete-archive');
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this archive entry?")) {
          let jData = loadJournalData();
          // Use optional chaining to avoid errors if readings is undefined
          jData[skill] = jData[skill].filter(en => en.date !== entry.date || (en.readings?.toString() !== entry.readings?.toString()));
          saveJournalData(jData);
          renderJournalDataUI(archiveContainer);
        }
      });
      skillContainer.appendChild(entryDiv);
    });
    archiveContainer.appendChild(skillContainer);
  }
  if (!hasEntries) {
    archiveContainer.innerHTML = "<p>No archived entries available.</p>";
  }
}

function autoArchiveAll(expRateDiv, totalExpDiv, ocrResultsContainer) {
  // This function remains unchanged but is no longer automatically called.
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
    const totalExp = lastVal - firstVal;
    const dateStr = new Date(previousReadings[previousReadings.length - 1].timestamp).toISOString().split('T')[0];
    if (!journalData[skill]) journalData[skill] = [];
    const exists = journalData[skill].find(e => e.date === dateStr);
    if (exists) continue;
    const journalEntry = {
      date: dateStr,
      skill: skill,
      readings: previousReadings,
      totalExp: totalExp
    };
    journalData[skill].push(journalEntry);
    skillData[skill] = skillData[skill].filter(r => r.timestamp >= startOfToday);
    updated = true;
  }
  if (updated) {
    saveJournalData(journalData);
    saveSkillData();
    renderSkillDataUI(document.getElementById("ocr-results-container"));
    updateExpRate(expRateDiv);
    updateTotalExp(totalExpDiv);
  }
}

export { initSkillEvents, addSkillReading, archiveData, renderJournalDataUI, autoArchiveAll };