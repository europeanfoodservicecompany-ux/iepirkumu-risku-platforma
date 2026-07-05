import { useState } from 'react';

// "Kopēt saiti" poga — kopē dalāmu saiti uz statisko /p/ lapu (ar sociālo tīklu priekšskatījumu).
export function CopyLink({ path, label = 'Kopēt saiti' }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  const url = `https://iepirkumurisks.lv/${path}`;
  return (
    <button className="filter-btn" title={url} onClick={async () => {
      try { await navigator.clipboard.writeText(url); } catch { /* dažos pārlūkos var neizdoties */ }
      setDone(true); setTimeout(() => setDone(false), 2000);
    }}>{done ? '✓ Saite nokopēta' : `🔗 ${label}`}</button>
  );
}
