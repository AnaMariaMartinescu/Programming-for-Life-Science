export function make(tag, props = {}, parent) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  if (parent) parent.appendChild(el);
  return el;
}
export const eh = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));