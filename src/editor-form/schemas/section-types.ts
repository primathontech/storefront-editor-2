// Mirror of @shopkit/builder SECTION_TYPES — kept local to avoid pulling
// the full builder package into the editor app.
export const SECTION_TYPES = {
  HEADER_SECTION: "HEADER_SECTION",
  GRID_SECTION: "GRID_SECTION",
  HERO_SECTION: "HERO_SECTION",
  CONTENT_SECTION: "CONTENT_SECTION",
  FOOTER_SECTION: "FOOTER_SECTION",
} as const;

export type SectionType = (typeof SECTION_TYPES)[keyof typeof SECTION_TYPES];
