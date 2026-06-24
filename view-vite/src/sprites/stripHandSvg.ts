/** Remove full-canvas background rects from the hand artwork. */
export function stripHandSvg(raw: string): string {
  return raw
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .replace(
      /<path d="M0 0 C413\.82 0 827\.64 0 1254 0[^"]*"[^/]*\/>/g,
      "",
    );
}
