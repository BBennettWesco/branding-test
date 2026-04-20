async function loadTheme(brand, mode = "light") {

const theme = await fetch(`/themes/${brand}.json`)
.then(r => r.json())

const tokens = theme[mode]

Object.keys(tokens).forEach(key => {

document.documentElement.style.setProperty(
`--color-${key.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`,
tokens[key]
)

})

localStorage.setItem("brand", brand)
localStorage.setItem("mode", mode)

}

/* init */

const brand = localStorage.getItem("brand") || "ocean"
const mode = localStorage.getItem("mode") || "light"

loadTheme(brand, mode)



/* Brand Switcher */
const brandSelect = document.getElementById("brandSwitcher")

brandSelect.addEventListener("change", e => {

const mode = localStorage.getItem("mode") || "light"
loadTheme(e.target.value, mode)

})

document.getElementById("modeToggle").onclick = () => {

const brand = localStorage.getItem("brand") || "default"

const current = localStorage.getItem("mode") || "light"
const next = current === "dark" ? "light" : "dark"

loadTheme(brand, next)

}