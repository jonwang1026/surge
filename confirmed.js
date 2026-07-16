const RESULTS = {
  success: {
    title: "You're in.",
    copy: "Early access confirmed. We’ll let you know when the first products are ready.",
    link: "Return home",
    href: "/homepage/",
  },
  temporary: {
    title: "Not quite yet.",
    copy: "We couldn’t confirm your email right now. Try the link in your email again shortly.",
    link: "Return to early access",
    href: "/earlyaccess/",
  },
  invalid: {
    title: "Link expired.",
    copy: "This confirmation link is no longer valid. Request a new one to continue.",
    link: "Request a new link",
    href: "/earlyaccess/",
  },
};

const url = new URL(window.location.href);
const result = RESULTS[url.searchParams.get("status")] || RESULTS.invalid;
document.querySelector("[data-confirmation-title]").textContent = result.title;
document.querySelector("[data-confirmation-copy]").textContent = result.copy;
const link = document.querySelector("[data-confirmation-link]");
link.textContent = result.link;
link.href = result.href;
window.history.replaceState({}, "", url.pathname);
