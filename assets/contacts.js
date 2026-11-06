async function copyUsername(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Older browsers and blocked Clipboard API access can use the selection API.
  }
  const focus = document.activeElement;
  const field = document.createElement("textarea");
  field.value = value;
  field.readOnly = true;
  field.style.cssText = "position:fixed;left:-9999px;top:0;";
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { /* Show manual-copy feedback below. */ }
  field.remove();
  focus?.focus({ preventScroll: true });
  return copied;
}

const status = document.getElementById("contact-copy-status");
for (const button of document.querySelectorAll("[data-copy-username]")) {
  let reset;
  button.addEventListener("click", async () => {
    const copied = await copyUsername(button.querySelector("code").textContent.trim());
    clearTimeout(reset);
    button.dataset.copied = String(copied);
    button.querySelector(".copy-feedback").textContent = copied ? "Copied" : "Try again";
    status.textContent = copied ? `${button.dataset.service} username copied.` : "Couldn’t copy. Select the username and copy it manually.";
    reset = setTimeout(() => {
      button.querySelector(".copy-feedback").textContent = "Copy";
      delete button.dataset.copied;
    }, 2000);
  });
}
