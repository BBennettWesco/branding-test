function applyTheme(brand, mode){

  const theme = themes[brand][mode];
  const root = document.documentElement;

  Object.entries(theme).forEach(([key,value])=>{
    root.style.setProperty(`--color-${key}`, value);
  });

}

let currentBrand = "blue";

function toggleDark(){

  document.documentElement.classList.toggle("dark");

  const mode =
    document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  applyTheme(currentBrand, mode);
}

function switchBrand(brand){

  currentBrand = brand;

  const mode =
    document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  applyTheme(brand, mode);

}