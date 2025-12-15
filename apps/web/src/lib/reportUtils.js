export function downloadJSON(filenameBase, data) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${filenameBase}-${ts}.json`;

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export async function copyToClipboard(text) {
  if (!text) return false;

  // Modern API
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  // Fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "true");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  return ok;
}

export function clip(str, n = 160) {
  const s = String(str || "").trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
