/* Copies the homepage's plain-text agent handoff with accessible feedback.
 * Exports: none; binds the copy button when the deferred script loads.
 * Dependencies: DOM and Clipboard API. */
// @ts-check

const copyButton = document.querySelector('#copy-btn');
const agentText = document.querySelector('#agent-text');
const copyStatus = document.querySelector('#copy-status');

/** @returns {Promise<void>} */
async function copyAgentInstructions() {
  if (!(copyButton instanceof HTMLButtonElement) || !agentText || !copyStatus) return;
  copyButton.disabled = true;
  try {
    await navigator.clipboard.writeText(agentText.textContent ?? '');
    copyStatus.textContent = 'Copied. Paste these instructions into your agent.';
  } catch {
    copyStatus.textContent = 'Clipboard unavailable. Select and copy the instructions above.';
    if (agentText instanceof HTMLElement) agentText.focus();
  } finally {
    copyButton.disabled = false;
  }
}

copyButton?.addEventListener('click', copyAgentInstructions);
