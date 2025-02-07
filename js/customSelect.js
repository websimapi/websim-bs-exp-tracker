"use strict";

// Mapping of skill values to icon paths
const skillIconMap = {
  chef: "/36px-Chef_icon.webp",
  woodcutter: "/36px-Woodcutter_icon.webp",
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
  scout: "/36px-Scout_icon.webp"
};

function createCustomSelect(selectElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select-wrapper";
  const styledSelect = document.createElement("div");
  styledSelect.className = "custom-select";

  const selectedDiv = document.createElement("div");
  selectedDiv.className = "custom-select-text";

  // Set initial selected option from the original select element with icon and text
  const initialSelected = selectElement.options[selectElement.selectedIndex];
  const initialValue = initialSelected.value;
  const initialIconSrc = skillIconMap[initialValue] || "";
  if (initialIconSrc) {
    const img = document.createElement("img");
    img.src = initialIconSrc;
    img.alt = initialSelected.textContent;
    img.style.width = "24px";
    img.style.height = "24px";
    img.style.marginRight = "8px";
    selectedDiv.appendChild(img);
  }
  const span = document.createElement("span");
  span.textContent = initialSelected.textContent;
  selectedDiv.appendChild(span);
  styledSelect.appendChild(selectedDiv);

  const optionsDiv = document.createElement("div");
  optionsDiv.className = "custom-options";

  Array.from(selectElement.options).forEach(option => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "custom-option";
    optionDiv.setAttribute("data-value", option.value);
    // Create an image for the option icon if available
    const iconSrc = skillIconMap[option.value] || "";
    if (iconSrc) {
      const img = document.createElement("img");
      img.src = iconSrc;
      img.alt = option.textContent;
      img.style.width = "24px";
      img.style.height = "24px";
      img.style.marginRight = "8px";
      optionDiv.appendChild(img);
    }
    // Append option text
    const textSpan = document.createElement("span");
    textSpan.textContent = option.textContent;
    optionDiv.appendChild(textSpan);
    if (option.selected) {
      optionDiv.classList.add("selected");
    }
    optionsDiv.appendChild(optionDiv);
  });

  styledSelect.appendChild(optionsDiv);
  wrapper.appendChild(styledSelect);
  selectElement.style.display = "none";
  selectElement.parentNode.insertBefore(wrapper, selectElement);

  // Event listeners
  styledSelect.addEventListener("click", () => {
    styledSelect.classList.toggle("open");
    optionsDiv.style.display = styledSelect.classList.contains("open") ? "block" : "none";
  });

  Array.from(optionsDiv.children).forEach(optionDiv => {
    optionDiv.addEventListener("click", (e) => {
      e.stopPropagation();
      // Remove selected from previous
      optionsDiv.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("selected"));
      optionDiv.classList.add("selected");
      const newValue = optionDiv.getAttribute("data-value");
      selectElement.value = newValue;

      // Update the text and icon on the styled select
      selectedDiv.innerHTML = "";
      const newIconSrc = skillIconMap[newValue] || "";
      if (newIconSrc) {
        const img = document.createElement("img");
        img.src = newIconSrc;
        img.alt = optionDiv.textContent;
        img.style.width = "24px";
        img.style.height = "24px";
        img.style.marginRight = "8px";
        selectedDiv.appendChild(img);
      }
      const newSpan = document.createElement("span");
      newSpan.textContent = optionDiv.textContent;
      selectedDiv.appendChild(newSpan);

      styledSelect.classList.remove("open");
      optionsDiv.style.display = "none";
      // Trigger change event on the original select element
      selectElement.dispatchEvent(new Event("change"));
    });
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