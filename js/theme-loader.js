const root = document.documentElement;
const brandSwitcher = document.getElementById("brandSwitcher");

if (brandSwitcher) {
  const savedBrand = localStorage.getItem("brand");

  if (savedBrand) {
    root.setAttribute("data-brand", savedBrand);
    brandSwitcher.value = savedBrand;
  }

  brandSwitcher.addEventListener("change", (event) => {
    const brand = event.target.value;
    root.setAttribute("data-brand", brand);
    localStorage.setItem("brand", brand);
  });
}