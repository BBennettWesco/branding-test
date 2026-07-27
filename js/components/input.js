(function () {
  const INPUT_SELECTOR = "input[type='checkbox'], input[type='radio']";

  function findIconForInput(input) {
    // Prefer the icon inside the immediate visual control sibling.
    let sibling = input.nextElementSibling;
    while (sibling) {
      if (sibling.classList?.contains("fluid-checkbox") || sibling.classList?.contains("fluid-radio")) {
        return sibling.querySelector("i");
      }

      // Stop once we reach text content to avoid grabbing unrelated icons.
      if (sibling.classList?.contains("label-text")) {
        break;
      }

      sibling = sibling.nextElementSibling;
    }

    // Fallback: within a wrapping label structure.
    const label = input.closest("label");
    if (!label) {
      return null;
    }

    const controls = label.querySelectorAll(".fluid-checkbox, .fluid-radio");
    for (const control of controls) {
      if (control.previousElementSibling === input) {
        return control.querySelector("i");
      }
    }

    return label.querySelector(".fluid-checkbox i, .fluid-radio i");
  }

  function syncIconState(input) {
    const icon = findIconForInput(input);
    if (!icon) {
      return;
    }

    const showSlash = input.disabled && !input.checked;
    icon.classList.toggle("fa-slash", showSlash);
    icon.classList.toggle("fa-check", !showSlash);
  }

  function syncAll(root) {
    root.querySelectorAll(INPUT_SELECTOR).forEach(syncIconState);
  }

  function onInputChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches(INPUT_SELECTOR)) {
      return;
    }

    syncIconState(input);

    // Radio changes affect the whole group.
    if (input.type === "radio" && input.name) {
      document
        .querySelectorAll("input[type='radio'][name='" + CSS.escape(input.name) + "']")
        .forEach(syncIconState);
    }
  }

  function observeStateChanges() {
    const observer = new MutationObserver((mutations) => {
      const inputsToSync = new Set();

      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (target instanceof HTMLInputElement && target.matches(INPUT_SELECTOR)) {
            inputsToSync.add(target);
          }
        }

        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) {
              return;
            }

            if (node.matches(INPUT_SELECTOR)) {
              inputsToSync.add(node);
            }

            node.querySelectorAll?.(INPUT_SELECTOR).forEach((input) => {
              inputsToSync.add(input);
            });
          });
        }
      }

      inputsToSync.forEach(syncIconState);
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled", "checked"],
    });
  }

  function init() {
    syncAll(document);
    document.addEventListener("change", onInputChange);
    observeStateChanges();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
