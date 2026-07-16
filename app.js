const FORMULAS = {
  surge: {
    name: "SURGE",
    detail: "Caffeinated",
    caseDetail: "POCKET GUM / S—01",
    caption: "A brushed aluminum SURGE pocket case on a SURGE Blue product stage.",
    themeColor: "#9ddcf0",
  },
  resurge: {
    name: "RESURGE",
    detail: "Caffeine-free",
    caseDetail: "CAFFEINE-FREE / R—01",
    caption: "A brushed aluminum RESURGE pocket case on a RESURGE Teal product stage.",
    themeColor: "#9be3d3",
  },
};

const stage = document.querySelector(".dossier-object");
const dossier = document.querySelector(".dossier");
const themeColor = document.querySelector('meta[name="theme-color"]');

const setFormula = (formulaKey, updateUrl = true) => {
  const formula = FORMULAS[formulaKey];
  if (!formula || !stage) return;

  document.querySelectorAll(".formula-button").forEach((candidate) => {
    const isActive = candidate.dataset.formula === formulaKey;
    candidate.classList.toggle("is-active", isActive);
    candidate.setAttribute("aria-pressed", String(isActive));
  });

  document.documentElement.dataset.formula = formulaKey;
  dossier.dataset.formula = formulaKey;
  stage.dataset.formulaStage = formulaKey;
  document.querySelector(".product-case--dossier .case-mark").textContent = formula.name;
  document.querySelector(".product-case--dossier .case-detail").textContent = formula.caseDetail;
  document.querySelector("[data-formula-detail]").textContent = formula.detail;
  document.querySelector("[data-product-caption]").textContent = formula.caption;
  themeColor?.setAttribute("content", formula.themeColor);

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (formulaKey === "surge") url.searchParams.delete("formula");
    else url.searchParams.set("formula", formulaKey);
    window.history.replaceState({}, "", url);
  }
};

document.querySelectorAll(".formula-button").forEach((button) => {
  button.addEventListener("click", () => {
    setFormula(button.dataset.formula);
  });
});

const initialFormula = new URLSearchParams(window.location.search).get("formula");
if (initialFormula && FORMULAS[initialFormula]) setFormula(initialFormula, false);

const form = document.querySelector(".signup");

if (form) {
  const input = form.querySelector('input[type="email"]');
  const submitButton = form.querySelector('button[type="submit"]');
  const message = form.querySelector(".form-message");
  const fields = form.querySelector("[data-signup-fields]");
  const confirmation = form.querySelector("[data-signup-confirmation]");
  const resetButton = confirmation.querySelector(".signup-reset");
  const renderedAt = form.querySelector('input[name="renderedAt"]');
  const company = form.querySelector('input[name="company"]');
  const completeEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const hasCompleteEmail = () =>
    input.validity.valid && completeEmailPattern.test(input.value.trim());

  const clearMessage = () => {
    message.textContent = "";
    message.className = "form-message";
    message.removeAttribute("role");
  };

  const showError = () => {
    message.textContent = "Enter a valid email address.";
    message.className = "form-message is-error";
    message.setAttribute("role", "alert");
    input.setAttribute("aria-invalid", "true");
  };

  const showTemporaryError = (
    text = "Couldn’t send the confirmation email. Check your connection and try again.",
  ) => {
    message.textContent = text;
    message.className = "form-message is-error";
    message.setAttribute("role", "alert");
  };

  const setPending = (pending) => {
    form.setAttribute("aria-busy", String(pending));
    input.disabled = pending;
    submitButton.disabled = pending;
    submitButton.textContent = pending ? "Joining…" : "Join";
  };

  input.addEventListener("blur", () => {
    if (input.value && !hasCompleteEmail()) showError();
  });

  input.addEventListener("input", () => {
    if (hasCompleteEmail()) {
      input.removeAttribute("aria-invalid");
      clearMessage();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;

    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    if (!hasCompleteEmail()) {
      showError();
      input.focus();
      return;
    }

    input.removeAttribute("aria-invalid");
    setPending(true);
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: input.value.trim(),
          company: company.value,
          renderedAt: Number(renderedAt.value),
        }),
      });

      if (response.status === 202) {
        fields.hidden = true;
        confirmation.hidden = false;
        return;
      }
      if (response.status === 400) {
        showError();
        input.focus();
        return;
      }
      if (response.status === 429) {
        showTemporaryError("Too many attempts. Please wait and try again.");
        return;
      }
      showTemporaryError();
    } catch {
      showTemporaryError();
    } finally {
      setPending(false);
    }
  });

  resetButton.addEventListener("click", () => {
    confirmation.hidden = true;
    fields.hidden = false;
    form.reset();
    renderedAt.value = String(Date.now());
    clearMessage();
    input.removeAttribute("aria-invalid");
    input.focus();
  });

  renderedAt.value = String(Date.now());
}

const supportsPointerTilt = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reducesMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (supportsPointerTilt && !reducesMotion) {
  document.querySelectorAll("[data-tilt]").forEach((element) => {
    let bounds;

    element.addEventListener("pointerenter", () => {
      bounds = element.getBoundingClientRect();
    });

    element.addEventListener("pointermove", (event) => {
      bounds ??= element.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      element.style.setProperty("--tilt-x", `${x * 7}deg`);
      element.style.setProperty("--tilt-y", `${y * -7}deg`);
    });

    element.addEventListener("pointerleave", () => {
      bounds = undefined;
      element.style.removeProperty("--tilt-x");
      element.style.removeProperty("--tilt-y");
    });
  });
}
