// The sign-in screen: email > emailed 6-digit code > in. Shown before
// anything else loads when the app's owner has turned sign-in on.
//
// Loaded after app.js and uses its globals ($, el, audio).

const REASONS = {
  removed: "Your email was taken off the list, so you've been signed out.",
  "signed-out": "You've been signed out. Sign in again to keep listening.",
  "offline-too-long": "The app hasn't been able to check your sign-in for a few days. Connect to the internet and sign in again.",
};

function showSignIn(status) {
  audio.pause();
  const box = $("signin");
  let email = status.email || "";
  const msg = el("p", { class: "status", role: "status" }, REASONS[status.reason] || "");
  if (status.reason) msg.classList.add("error");
  const say = (text, error = false) => {
    msg.textContent = text;
    msg.classList.toggle("error", error);
  };

  const emailInput = el("input", { type: "email", required: "", placeholder: "you@example.com", autocomplete: "email", value: email, "aria-label": "Email" });
  const codeInput = el("input", { type: "text", inputmode: "numeric", maxlength: "6", pattern: "[0-9]{6}", placeholder: "6-digit code", autocomplete: "one-time-code", "aria-label": "Code" });

  const busy = (form, on) => form.querySelectorAll("button, input").forEach((n) => (n.disabled = on));

  const emailForm = el(
    "form",
    {
      class: "signin-form",
      onsubmit: async (e) => {
        e.preventDefault();
        email = emailInput.value.trim();
        busy(emailForm, true);
        say("Sending a code…");
        try {
          await window.api.sendCode(email);
          emailForm.hidden = true;
          codeForm.hidden = false;
          codeText.textContent = `We emailed a code to ${email}. It can take a minute, and it might land in spam.`;
          say("");
          codeInput.focus();
        } catch (err) {
          say(err.message, true);
        } finally {
          busy(emailForm, false);
        }
      },
    },
    emailInput,
    el("button", { type: "submit", class: "btn btn-primary" }, "Send code"),
  );

  const codeText = el("p", { class: "muted" });
  const codeForm = el(
    "form",
    {
      class: "signin-form",
      hidden: "",
      onsubmit: async (e) => {
        e.preventDefault();
        busy(codeForm, true);
        say("Checking…");
        try {
          await window.api.verifyCode(email, codeInput.value);
          say("You're in.");
          location.reload();
        } catch (err) {
          say(err.message, true);
          busy(codeForm, false);
          codeInput.select();
        }
      },
    },
    codeInput,
    el("button", { type: "submit", class: "btn btn-primary" }, "Sign in"),
    el("button", { type: "button", class: "link-btn", onclick: () => ((codeForm.hidden = true), (emailForm.hidden = false), say("")) }, "Use a different email"),
  );

  box.replaceChildren(
    el(
      "div",
      { class: "signin-card" },
      el("h2", {}, "Sign in to Playlist Merger"),
      el("p", { class: "muted" }, "Enter the email you were invited with. We'll send you a code."),
      emailForm,
      codeText,
      codeForm,
      msg,
    ),
  );
  box.hidden = false;
  (email ? emailForm.querySelector("button") : emailInput).focus();
}

function showAccount(status) {
  const node = $("account");
  if (!status.required || !status.email) return;
  node.replaceChildren(
    el("span", { class: "account-email", title: status.email }, status.email),
    el(
      "button",
      {
        type: "button",
        class: "link-btn",
        onclick: async () => {
          await window.api.signOut().catch(() => {});
          location.reload();
        },
      },
      "Sign out",
    ),
  );
  node.hidden = false;
}

// Access ended while the app was open (removed from the list).
window.api.onLocked((status) => {
  window.jam?.active && document.querySelector(".jam-active .btn-danger")?.click();
  showSignIn(status);
});
