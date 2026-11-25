/**
 * Remove o bloco gerado automaticamente pelo GitHub nas notas de release
 * ("What's Changed", "New Contributors" e "Full Changelog"), mantendo apenas
 * o texto escrito manualmente pelo autor da release.
 */
const AUTO_SECTIONS = [
  /^##\s+What's Changed\s*$/im,
  /^##\s+New Contributors\s*$/im,
  /^\*\*Full Changelog\*\*:/im
];

export function cleanReleaseBody(body) {
  if (!body) return '';

  const text = String(body);
  let cut = text.length;

  for (const pattern of AUTO_SECTIONS) {
    const match = pattern.exec(text);
    if (match && match.index < cut) cut = match.index;
  }

  return text
    .slice(0, cut)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
