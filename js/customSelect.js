"use strict";

function createCustomSelect(selectElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select-wrapper";
  const styledSelect = document.createElement("div");
  styledSelect.className = "custom-select";

  const selectedDiv = document.createElement("div");
  selectedDiv.className = "custom-select-text";

  // Set initial selected option from the original select element
  const initialSelected = selectElement.options[selectElement.selectedIndex];
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

      // Update the text on the styled select
      selectedDiv.innerHTML = "";
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