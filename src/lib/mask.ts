/** Mask a full name for staff lists where the full name is not needed: "Murugan Ramasamy" -> "M*** R******". */
export function maskedName(full: string): string {
  return full
    .trim()
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? part : `${part[0]}${'*'.repeat(Math.min(part.length - 1, 5))}`))
    .join(' ');
}
