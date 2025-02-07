"use strict";

const optgroupBgColors = {
  "Hopeport": "#95905d",
  "Hopeforest": "#93d857",
  "Mine of Mantuban": "#6dc3fc",
  "Crenopolis": "#878372"
};

function createCustomSelect(selectElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select-wrapper";
  const styledSelect = document.createElement("div");
  styledSelect.className = "custom-select";

  const selectedDiv = document.createElement("div");
  selectedDiv.className = "custom-select-text";

  // Set initial selected option from the original select element
  let initialSelected;
  // If there are optgroups, find the first option within the first group
  if (selectElement.querySelector("optgroup")) {
    initialSelected = selectElement.querySelector("optgroup").querySelector("option");
  } else {
    initialSelected = selectElement.options[selectElement.selectedIndex];
  }
  const initialIcon = initialSelected.getAttribute("data-icon");
  if (initialIcon) {
    const img = document.createElement("img");
    img.src = initialIcon;
    selectedDiv.appendChild(img);
  }
  const span = document.createElement("span");
  span.textContent = initialSelected.textContent;
  selectedDiv.appendChild(span);
  styledSelect.appendChild(selectedDiv);

  const optionsDiv = document.createElement("div");
  optionsDiv.className = "custom-options";

  // Process children of the select element to support optgroups
  Array.from(selectElement.children).forEach(child => {
    if (child.tagName.toLowerCase() === "optgroup") {
      // Create a label element for the optgroup
      const groupLabelDiv = document.createElement("div");
      groupLabelDiv.className = "custom-optgroup-label";
      const groupLabel = child.label;
      groupLabelDiv.textContent = groupLabel;
      if (optgroupBgColors[groupLabel]) {
        groupLabelDiv.style.backgroundColor = optgroupBgColors[groupLabel];
      }
      optionsDiv.appendChild(groupLabelDiv);
      // Process options within the optgroup
      Array.from(child.children).forEach(option => {
        const optionDiv = createOptionDiv(option);
        optionsDiv.appendChild(optionDiv);
      });
    } else if (child.tagName.toLowerCase() === "option") {
      const optionDiv = createOptionDiv(child);
      optionsDiv.appendChild(optionDiv);
    }
  });

  styledSelect.appendChild(optionsDiv);
  wrapper.appendChild(styledSelect);
  selectElement.style.display = "none";
  selectElement.parentNode.insertBefore(wrapper, selectElement);

  // Event listeners for styledSelect
  styledSelect.addEventListener("click", () => {
    styledSelect.classList.toggle("open");
    optionsDiv.style.display = styledSelect.classList.contains("open") ? "block" : "none";
  });

  // Close dropdown if clicked outside
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      styledSelect.classList.remove("open");
      optionsDiv.style.display = "none";
    }
  });
}

function createOptionDiv(option) {
  const optionDiv = document.createElement("div");
  optionDiv.className = "custom-option";
  optionDiv.setAttribute("data-value", option.value);
  const icon = option.getAttribute("data-icon");
  if (icon) {
    const img = document.createElement("img");
    img.src = icon;
    optionDiv.appendChild(img);
  }
  const textSpan = document.createElement("span");
  textSpan.textContent = option.textContent;
  optionDiv.appendChild(textSpan);
  if (option.selected) {
    optionDiv.classList.add("selected");
  }
  optionDiv.addEventListener("click", (e) => {
    e.stopPropagation();
    // Remove selected class from all sibling options
    const siblings = optionDiv.parentElement.querySelectorAll(".custom-option");
    siblings.forEach(opt => opt.classList.remove("selected"));
    optionDiv.classList.add("selected");
    const newValue = optionDiv.getAttribute("data-value");
    // Update the original select element
    const selectEl = optionDiv.closest(".custom-select-wrapper").previousElementSibling;
    selectEl.value = newValue;
    // Update the selectedDiv content
    const selectedDiv = optionDiv.closest(".custom-select").querySelector(".custom-select-text");
    selectedDiv.innerHTML = "";
    if (optionDiv.querySelector("img")) {
      const newImg = document.createElement("img");
      newImg.src = optionDiv.querySelector("img").src;
      selectedDiv.appendChild(newImg);
    }
    const newSpan = document.createElement("span");
    newSpan.textContent = optionDiv.textContent;
    selectedDiv.appendChild(newSpan);
    // Close the dropdown
    optionDiv.closest(".custom-select").classList.remove("open");
    optionDiv.parentElement.style.display = "none";
    // Trigger change event on the original select element
    selectEl.dispatchEvent(new Event("change"));
  });
  return optionDiv;
}

document.addEventListener("DOMContentLoaded", () => {
  const selectElements = document.querySelectorAll("select");
  selectElements.forEach(select => {
    createCustomSelect(select);
  });
});

export { createCustomSelect };