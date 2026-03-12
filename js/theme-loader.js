function applyTheme(brand, mode){

  const theme = themes[brand][mode];
  const root = document.documentElement;

  Object.entries(theme).forEach(([key,value])=>{
    root.style.setProperty(`--color-${key}`, value);
  });

}

const brandSwitcher = document.getElementById("brandSwitcher")
const savedBrand = localStorage.getItem("brand")

if(savedBrand){
document.documentElement.setAttribute("data-brand", savedBrand)
themeSwitcher.value = savedBrand
}

brandSwitcher.addEventListener("change",(e)=>{

const brand = e.target.value

document.documentElement.setAttribute("data-brand", brand)

localStorage.setItem("brand", brand)

})



/* MODE SWITCH */

const toggle = document.getElementById("modeToggle")

const savedMode = localStorage.getItem("mode")

if(savedMode){
document.documentElement.setAttribute("data-mode", savedMode)
}

toggle.addEventListener("click",()=>{

const current = document.documentElement.getAttribute("data-mode")

const next = current === "dark" ? "light" : "dark"

document.documentElement.setAttribute("data-mode", next)

localStorage.setItem("mode", next)

})