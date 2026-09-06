/* Single narrative shared by the hero timeline and the lower explanation.
 * Exports: renderStory and connectStory for automatic and manual selection.
 * Dependencies: static, accessible timeline markup; no wallet or network calls. */
// @ts-check

const STAGES = [
  { title: 'You define the permission.', text: 'In this example, you authorize USDC spending up to 100 USDC per day, with a seven-day expiry. Your main wallet owns the User Proxy and holds the funds until execution.', takeaway: 'Your agent holds permission, never your trading funds.', diagram: '[ MAIN WALLET ] ── permission ──▶ [ USER PROXY ]' },
  { title: 'The agent signs an intent.', text: 'The agent signs a 25 USDC intent off-chain with its own key. A relayer announces the signed intent and pays submission gas. The agent needs no trading funds or gas balance.', takeaway: 'A signature from your agent. Gas paid by the relayer.', diagram: '[ AGENT SIGNATURE ] ──▶ [ RELAYER PAYS GAS ]' },
  { title: 'Your proxy checks the permission.', text: 'When a solver attempts the fill, the proxy checks the agent, the allowed action and token, expiry, and remaining budget before pulling 25 USDC from your main wallet.', takeaway: 'Input comes from your main wallet, never the agent wallet.', diagram: '[ MAIN WALLET ] ── authorized input ──▶ [ PROXY ]' },
  { title: 'The fill must meet your terms.', text: 'The solver submits the fill and pays its transaction gas. Settlement enforces the output floor and sends WETH to your main wallet. A fill below the required floor reverts.', takeaway: 'WETH arrives in your main wallet. The solver pays fill gas.', diagram: '[ SOLVER PAYS GAS ] ── WETH ──▶ [ MAIN WALLET ]' },
];

/** @param {number} index @returns {void} */
export function renderStory(index) {
  const stage = STAGES[index];
  if (!stage) return;
  document.querySelectorAll('button[data-stage]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.getAttribute('data-stage')) === index));
  });
  document.querySelectorAll('[data-journey-row]').forEach((row) => {
    const rowIndex = Number(row.getAttribute('data-journey-row'));
    row.classList.toggle('is-active', rowIndex === index);
    row.classList.toggle('is-complete', rowIndex < index);
  });
  const content = { '#stage-title': stage.title, '#stage-description': stage.text,
    '#stage-diagram': stage.diagram, '#journey-takeaway': stage.takeaway,
    '#journey-progress': `0${index + 1} / 04 · ILLUSTRATIVE EXAMPLE` };
  for (const [selector, text] of Object.entries(content)) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }
}

/** @param {(stage:number)=>void} onChange @returns {void} */
export function connectStory(onChange) {
  document.querySelectorAll('button[data-stage]').forEach((button) => {
    button.addEventListener('click', () => onChange(Number(button.getAttribute('data-stage'))));
  });
}
