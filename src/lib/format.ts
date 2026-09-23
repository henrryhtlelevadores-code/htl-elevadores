export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (word.includes(".")) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}