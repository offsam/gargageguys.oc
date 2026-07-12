/** Strip HTML and build unique meta descriptions (plain text, amp-escaped for HTML attrs). */

export function stripHtml(text) {
  return String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function seoMetaDescription(text, { fallback = '', maxLen = 142 } = {}) {
  const plain = stripHtml(text) || fallback;
  let desc = plain;
  if (desc.length > maxLen) {
    desc = `${desc.slice(0, maxLen).replace(/\s+\S*$/, '')}…`;
  }
  if (!/\(949\)\s*539-0009/.test(desc) && !/539-0009/.test(desc)) {
    desc = `${desc} Call (949) 539-0009.`;
  }
  return desc.replace(/&/g, '&amp;');
}
