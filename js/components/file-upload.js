const uploadDropzones = document.querySelectorAll("[data-upload-dropzone]");

uploadDropzones.forEach((dropzone) => {
  const inputId = dropzone.getAttribute("data-upload-input");
  const input = inputId ? document.getElementById(inputId) : null;

  if (!input || input.disabled) {
    return;
  }

  const activateFilePicker = () => {
    input.click();
  };

  dropzone.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea")) {
      return;
    }

    activateFilePicker();
  });

  dropzone.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    activateFilePicker();
  });

  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });

  dropzone.addEventListener("dragleave", (event) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && dropzone.contains(relatedTarget)) {
      return;
    }

    dropzone.classList.remove("is-dragover");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    input.files = files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
});