// Inlined from @shopkit/builder so the editor doesn't pull the
// builder runtime in. Drives the iframe's responsive sizing.
export const RESPONSIVE_FRAME_STYLE = {
  mobile: {
    width: 375,
    height: 667,
    transition: "width 0.2s, height 0.2s",
    boxShadow: "0 0 24px rgba(0,0,0,0.2)",
    borderRadius: 12,
    background: "white",
    border: "none",
    display: "block",
  },
  tablet: {
    width: 768,
    height: "min(1024px, 100%)",
    transition: "width 0.2s, height 0.2s",
    boxShadow: "0 0 24px rgba(0,0,0,0.2)",
    borderRadius: 12,
    background: "white",
    border: "none",
    display: "block",
  },
  desktop: {
    width: "100%",
    height: "100%",
    transition: "width 0.2s, height 0.2s",
    background: "white",
    border: "none",
    display: "block",
  },
  fullscreen: {
    width: "100%",
    height: "100%",
    background: "white",
    border: "none",
    display: "block",
  },
} as const;
