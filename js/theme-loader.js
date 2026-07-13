const root = document.documentElement;
const brandButtons = document.querySelectorAll("#select-brand [data-css-brand]");
const modeToggleButton = document.querySelector('.toggle-mode');
const modeToggleIcon = modeToggleButton ? modeToggleButton.querySelector("i") : null;

function setBrand(brand) {
  if (!brand) {
    return;
  }

  root.setAttribute("data-brand", brand);
  localStorage.setItem("brand", brand);
}

const savedBrand = localStorage.getItem("brand");

if (savedBrand) {
  setBrand(savedBrand);
}

brandButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setBrand(button.dataset.cssBrand);
  });
});

function setMode(mode) {
  root.setAttribute("data-mode", mode);

  if (modeToggleIcon) {
    modeToggleIcon.classList.remove("fa-moon", "fa-sun");
    modeToggleIcon.classList.add(mode === "invert" ? "fa-sun" : "fa-moon");
  }
}

setMode("default");

if (modeToggleButton) {
  modeToggleButton.addEventListener("click", () => {
    const currentMode = root.getAttribute("data-mode");
    setMode(currentMode === "invert" ? "default" : "invert");
  });
}