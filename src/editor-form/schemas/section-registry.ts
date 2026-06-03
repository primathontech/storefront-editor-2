import type { SectionRegistry } from "@shopkit/editor-bridge";
import { SECTION_TYPES } from "./section-types";
/**
 * Section Registry for Visual Editor
 *
 * This registry defines the schema for each section type, which the editor
 * uses to generate the appropriate form fields in the sidebar.
 */
export const sectionRegistry: SectionRegistry = {
  [SECTION_TYPES.HEADER_SECTION]: {
    type: SECTION_TYPES.HEADER_SECTION,
    name: "Header Section",
    description: "A full-width header section for navigation and branding",
    settingsSchema: {},
  },

  [SECTION_TYPES.GRID_SECTION]: {
    type: SECTION_TYPES.GRID_SECTION,
    name: "Grid Section",
    description:
      "A flexible grid section for displaying products or content in a grid layout",
    settingsSchema: {
      responsive: {
        type: "spacing",
        label: "Section spacing",
        default: {},
      },
    },
  },

  [SECTION_TYPES.HERO_SECTION]: {
    type: SECTION_TYPES.HERO_SECTION,
    name: "Hero Section",
    description:
      "A prominent hero section for showcasing key content or products",
    settingsSchema: {
      responsive: {
        type: "spacing",
        label: "Section spacing",
        default: {},
      },
    },
  },

  [SECTION_TYPES.CONTENT_SECTION]: {
    type: SECTION_TYPES.CONTENT_SECTION,
    name: "Content Section",
    description:
      "A flexible content section for text, images, and mixed content",
    settingsSchema: {
      responsive: {
        type: "spacing",
        label: "Section spacing",
        default: {},
      },
    },
  },

  [SECTION_TYPES.FOOTER_SECTION]: {
    type: SECTION_TYPES.FOOTER_SECTION,
    name: "Footer Section",
    description: "A footer section for links, contact info, and legal content",
    settingsSchema: {
      responsive: {
        type: "spacing",
        label: "Section spacing",
        default: {},
      },
    },
  },
};
