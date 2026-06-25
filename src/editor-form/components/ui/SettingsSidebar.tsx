"use client";

import { sectionRegistry } from "../../schemas/section-registry";
import type { TranslationService } from "@shopkit/i18n";
import React, { useCallback, useMemo } from "react";
import { useRightSidebarWidth } from "../../context/RightSidebarWidthContext";
import { useTemplateStore } from "../../../stores/templateStore";
import { useThemeStore } from "../../../stores/themeStore";
import { focusSection } from "../../preview-bridge";
import { convertSchemaToFormSchema } from "../../utils/schema-converter";
import {
  DesignSidebar,
  DesignSidebarHeader,
  IconButton,
} from "./design-system";
import { DataSourceEditor } from "./DataSourceEditor";
import { DynamicForm } from "./DynamicForm";
import { CloseIcon } from "./icons/CloseIcon";
import { RemoveSectionButton } from "./RemoveSectionButton";
import { SidebarSkeleton } from "../../../components/SidebarSkeleton";
import styles from "./SettingsSidebar.module.css";

interface SettingsSidebarProps {
  translationService: TranslationService | null;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  translationService,
}) => {
  const { width } = useRightSidebarWidth();
  const {
    selectedSectionId,
    selectedWidgetId,
    pageConfig,
    updateSection,
    updateWidget,
    setShowSettingsDrawer,
    setSelectedSection,
    setSelectedWidget,
    removeSection,
  } = useTemplateStore();

  const currentPageConfig = pageConfig;

  // Derive selected section and widget data
  const selectedSection = useMemo(() => {
    if (!selectedSectionId || !currentPageConfig?.sections) {
      return null;
    }
    return (
      currentPageConfig.sections.find((s: any) => s.id === selectedSectionId) ||
      null
    );
  }, [selectedSectionId, currentPageConfig]);

  const selectedSectionSchema = useMemo(() => {
    return selectedSection
      ? sectionRegistry[selectedSection.type] || null
      : null;
  }, [selectedSection]);

  const selectedWidget = useMemo(() => {
    if (!selectedSection || !selectedWidgetId) {
      return null;
    }
    return (
      selectedSection.widgets?.find((w: any) => w.id === selectedWidgetId) ||
      null
    );
  }, [selectedSection, selectedWidgetId]);

  const widgetSchemas = useThemeStore((s) => s.schemas);
  const schemasReady = useThemeStore((s) => s.assetsStatus === "ready");
  const librarySections = useThemeStore((s) => s.sections);

  // A section is removable only if its type is in the available-sections
  // library — otherwise the user couldn't re-add it after removing.
  // Matches the old submodule's isSectionInLibrary check.
  const isRemovableSection = useMemo(() => {
    if (!selectedSection) return false;
    // Chrome (header/footer) sections are fixed structure — never removable,
    // regardless of whether they happen to match a library section id.
    if (selectedSection._chromeTemplateId) return false;
    return Object.values(librarySections).some((lib) => {
      const libId = (lib as { id?: string })?.id;
      if (!libId) return false;
      return (
        selectedSection.id === libId ||
        selectedSection.id.startsWith(`${libId}-`)
      );
    });
  }, [selectedSection, librarySections]);

  const selectedWidgetSchema = useMemo(() => {
    if (!selectedWidget?.type) {
      return null;
    }
    return widgetSchemas[selectedWidget.type] || null;
  }, [selectedWidget, widgetSchemas]);

  const isCustomHtmlWidget = selectedWidgetSchema?.type === "CustomHtml";

  // Handlers for settings changes
  const handleSectionSettingChange = useCallback(
    (key: string, value: any) => {
      if (!selectedSectionId) {
        return;
      }
      const section = currentPageConfig?.sections?.find(
        (s: any) => s.id === selectedSectionId
      );
      if (!section) {
        return;
      }

      updateSection(selectedSectionId, {
        settings: {
          ...section.settings,
          [key]: value,
        },
      });
    },
    [selectedSectionId, currentPageConfig, updateSection]
  );

  const handleWidgetSettingChange = useCallback(
    (key: string, value: any) => {
      if (!selectedSectionId || !selectedWidgetId) {
        return;
      }
      const section = currentPageConfig?.sections?.find(
        (s: any) => s.id === selectedSectionId
      );
      if (!section) {
        return;
      }
      const widget = section.widgets?.find(
        (w: any) => w.id === selectedWidgetId
      );
      if (!widget) {
        return;
      }

      updateWidget(selectedSectionId, selectedWidgetId, {
        settings: {
          ...widget.settings,
          [key]: value,
        },
      });
    },
    [selectedSectionId, selectedWidgetId, currentPageConfig, updateWidget]
  );

  const handleClose = useCallback(() => {
    setShowSettingsDrawer(false);
    setSelectedSection(null);
    setSelectedWidget(null);
    // Clear the iframe's selection too, so re-clicking the same widget
    // re-fires `select` (the iframe dedupes against its own selectedEl).
    focusSection(null);
  }, [setShowSettingsDrawer, setSelectedSection, setSelectedWidget]);

  const getTitle = () => {
    if (selectedWidget) {
      return `${selectedWidget.name || selectedWidgetSchema?.name}`;
    }
    if (selectedSection) {
      return `${selectedSectionSchema?.name}`;
    }
    return "Settings";
  };

  return (
    <DesignSidebar side="right" width={width}>
      <DesignSidebarHeader>
        <h3 className={styles.title}>{getTitle()}</h3>
        <IconButton
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          shape="square"
          onClick={handleClose}
          aria-label="Close settings"
        />
      </DesignSidebarHeader>

      <div className={styles.content}>
        {/* Sidebar is gated by `showSettingsDrawer` at the parent — when it
            mounts, a selection always exists. If schemas haven't landed yet
            (assets event still in flight), show the skeleton so the form
            doesn't pop in with "no schema" content. */}
        {!schemasReady && <SidebarSkeleton />}

        {/* Data source pickers for the selected section (re-point its
            collection/product). Rendered at the top of the inspector so the
            most consequential control is seen first. Renders null when the
            section has no editable data sources. */}
        {schemasReady && selectedSection && (
          <DataSourceEditor section={selectedSection} />
        )}

        {/* Widget Settings */}
        {schemasReady && selectedWidget && selectedWidgetSchema && (
          <>
            <DynamicForm
              schema={convertSchemaToFormSchema(
                selectedWidgetSchema.settingsSchema
              )}
              values={selectedWidget.settings}
              onUpdate={handleWidgetSettingChange}
              translationService={translationService}
              sectionId={selectedSectionId || undefined}
            />

            {/* Section Settings */}
            {selectedSection &&
              selectedSectionSchema &&
              // For Custom HTML widget, hide section-level settings entirely
              !isCustomHtmlWidget && (
                <DynamicForm
                  schema={convertSchemaToFormSchema(
                    selectedSectionSchema.settingsSchema
                  )}
                  values={selectedSection.settings}
                  onUpdate={handleSectionSettingChange}
                  translationService={translationService}
                  sectionId={selectedSectionId || undefined}
                />
              )}

          </>
        )}

        {schemasReady && selectedSection && isRemovableSection && (
          <RemoveSectionButton
            onClick={() => removeSection(selectedSection.id)}
          />
        )}
      </div>
    </DesignSidebar>
  );
};
