/** Remove presentation pictographs from historic log text without changing saved records. */
export function withoutEmoji(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u2680-\u2685\uFE0F\u200D\u20E3\u2605\u2713\u2715]/gu,
    ch => ch === "©" || ch === "®" || ch === "™" ? ch : "");
}
