"use strict";

// Mapping of skill values to icon paths
const skillIconMap = {
  chef: "/36px-Chef_icon.webp",
  // Using woodcutter icon for lumberjack
  lumberjack: "/36px-Woodcutter_icon.webp",
  forager: "/36px-Forager_icon.webp",
  alchemist: "/32px-Alchemist_icon.webp",
  fisher: "/36px-Fisher_icon.webp",
  bonewright: "/36px-Bonewright_icon.webp",
  blacksmith: "/36px-Blacksmith_icon.webp",
  detective: "/32px-Detective_icon.webp",
  merchant: "/36px-Merchant_icon.webp",
  stonemason: "/30px-Stonemason_icon.webp",
  carpenter: "/36px-Carpenter_icon.webp",
  watchperson: "/36px-Watchperson_icon.webp",
  guard: "/36px-Guard_icon.webp",
  miner: "/36px-Miner_icon.webp",
  gatherer: "/36px-Gatherer_icon.webp",
  leatherworker: "/36px-Leatherworker_icon.webp",
  scout: "/36px-Scout_icon.webp",
  // Additional mappings for new skills:
  minefighter: "/36px-Guard_icon.webp" // using guard icon as placeholder
};

function createCustomSelect(selectElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select-wrapper";
  const styledSelect = document.createElement("div");
  styledSelect.className = "custom-select";

  const selectedDiv = document.createElement("div");
  selectedDiv.className = "custom-select-text";

  // Function to update selected display based on a given option
  function updateSelectedDisplay(optionElement) {
    selectedDiv.innerHTML = "";
    const value = optionElement.value;
    const iconSrc = skillIconMap[value] || "";
    if (iconSrc) {
      const img = document.createElement("img");
      img.src = iconSrc;
      img.alt = optionElement.textContent.trim();
      img.style.width = "24px";
      img.style.height = "24px";
      img.style.marginRight = "8px";
      selectedDiv.appendChild(img);
    }
    const span = document.createElement("span");
    span.textContent = optionElement.textContent.trim();
    selectedDiv.appendChild(span);
  }

  // Set initial selected option from the original select element
  let initialOption = selectElement.querySelector("option:checked");
  if (!initialOption) {
    initialOption = selectElement.querySelector("option");
  }
  updateSelectedDisplay(initialOption);
  styledSelect.appendChild(selectedDiv);

  const optionsDiv = document.createElement("div");
  optionsDiv.className = "custom-options";

  // Iterate over children of the select element to support optgroups
  Array.from(selectElement.children).forEach(child => {
    if (child.tagName.toLowerCase() === "optgroup") {
      const groupDiv = document.createElement("div");
      groupDiv.className = "custom-optgroup";
      // Set group's label text
      const groupLabel = document.createElement("div");
      groupLabel.className = "custom-optgroup-label";
      groupLabel.textContent = child.label;
      // Apply background color from data attribute
      const bgColor = child.getAttribute("data-bg");
      if (bgColor) {
        groupLabel.style.backgroundColor = bgColor;
        groupLabel.style.color = "#fff";
        groupLabel.style.padding = "6px 10px";
      }
      groupDiv.appendChild(groupLabel);
      // Iterate over options inside optgroup
      Array.from(child.children).forEach(option => {
        const optionDiv = document.createElement("div");
        optionDiv.className = "custom-option";
        optionDiv.setAttribute("data-value", option.value);
        // Create an image for the option icon if available
        const iconSrc = skillIconMap[option.value] || "";
        if (iconSrc) {
          const img = document.createElement("img");
          img.src = iconSrc;
          img.alt = option.textContent.trim();
          img.style.width = "24px";
          img.style.height = "24px";
          img.style.marginRight = "8px";
          optionDiv.appendChild(img);
        }
        const textSpan = document.createElement("span");
        textSpan.textContent = option.textContent.trim();
        optionDiv.appendChild(textSpan);
        if (option.selected) {
          optionDiv.classList.add("selected");
        }
        groupDiv.appendChild(optionDiv);
      });
      optionsDiv.appendChild(groupDiv);
    } else if (child.tagName.toLowerCase() === "option") {
      // Fallback if there are direct option elements (no optgroup)
      const optionDiv = document.createElement("div");
      optionDiv.className = "custom-option";
      optionDiv.setAttribute("data-value", child.value);
      const iconSrc = skillIconMap[child.value] || "";
      if (iconSrc) {
        const img = document.createElement("img");
        img.src = iconSrc;
        img.alt = child.textContent.trim();
        img.style.width = "24px";
        img.style.height = "24px";
        img.style.marginRight = "8px";
        optionDiv.appendChild(img);
      }
      const textSpan = document.createElement("span");
      textSpan.textContent = child.textContent.trim();
      optionDiv.appendChild(textSpan);
      if (child.selected) {
        optionDiv.classList.add("selected");
      }
      optionsDiv.appendChild(optionDiv);
    }
  });
  
  styledSelect.appendChild(optionsDiv);
  wrapper.appendChild(styledSelect);
  selectElement.style.display = "none";
  selectElement.parentNode.insertBefore(wrapper, selectElement);

  // Event listeners for toggling open state
  styledSelect.addEventListener("click", () => {
    styledSelect.classList.toggle("open");
    optionsDiv.style.display = styledSelect.classList.contains("open") ? "block" : "none";
  });

  // Event listener for option selection within optionsDiv
  optionsDiv.addEventListener("click", (e) => {
    const optionDiv = e.target.closest(".custom-option");
    if (!optionDiv) return;
    // Remove selected class from all options
    optionsDiv.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("selected"));
    optionDiv.classList.add("selected");
    const newValue = optionDiv.getAttribute("data-value");
    selectElement.value = newValue;
    // Update selected display
    updateSelectedDisplay(selectElement.querySelector(`option[value="${newValue}"]`));
    styledSelect.classList.remove("open");
    optionsDiv.style.display = "none";
    // Trigger change event on the original select element
    selectElement.dispatchEvent(new Event("change"));
  });

  // Close dropdown if clicked outside
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      styledSelect.classList.remove("open");
      optionsDiv.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const selectElements = document.querySelectorAll("select");
  selectElements.forEach(select => {
    createCustomSelect(select);
  });
});

export { createCustomSelect };