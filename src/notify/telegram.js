import { env } from '../lib/env.js';

const esc = (s = '') => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export async function send(text) {
  if (!env.tg.token || !env.tg.chat) { console.log('[tg]', text); return; }
  const res = await fetch(`https://api.telegram.org/bot${env.tg.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.tg.chat,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) console.warn('[tg]', res.status, await res.text());
}

const SRC = { useme: 'Useme', bzp: 'BZP', bk: 'Baza Konkurencyjnosci' };

export function formatSignal(s) {
  const hot = s.relevance >= 70 ? '🔴 ' : s.relevance >= 45 ? '🟡 ' : '';
  const lines = [
    `${hot}<b>${esc(s.title)}</b>`,
    `${SRC[s.source] || s.source}${s.city ? ' · ' + esc(s.city) : ''} · trafnosc ${s.relevance}`,
  ];
  if (s.budget) lines.push(`Budzet: ${esc(s.budget)}`);
  if (s.deadlineAt) lines.push(`Termin: ${new Date(s.deadlineAt).toLocaleDateString('pl-PL')}`);
  if (s.isLocal) lines.push('📍 lokalne - mozliwa wizyta');
  lines.push(s.url);
  return lines.join('\n');
}

export async function sendBatch(signals) {
  if (!signals.length) return;
  // Po jednej wiadomosci na sygnal - latwiej reagowac z telefonu.
  for (const s of signals) await send(formatSignal(s));
}
