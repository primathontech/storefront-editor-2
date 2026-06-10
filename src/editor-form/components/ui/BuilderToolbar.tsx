import { useState } from "react";
import { Button } from "./design-system";
import { SidebarScrollArea } from "./Sidebar";
// dnd-kit imports
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { focusSection } from "../../preview-bridge";
import { useThemeStore } from "../../../stores/themeStore";
import { useTemplateStore } from "../../../stores/templateStore";
import { useEditorUiStore } from "../../../stores/editorUiStore";
import styles from "./BuilderToolbar.module.css";
import { SectionLibraryDialog } from "./SectionLibraryDialog";
import { SidebarSectionGroup } from "./SidebarSectionGroup";

export default function BuilderToolbar() {
  const availableSections = useThemeStore((s) => s.sections);

  const pageConfig = useTemplateStore((s) => s.pageConfig);
  const device = useEditorUiStore((s) => s.device);
  const {
    selectedWidgetId,
    setSelectedSection,
    setSelectedWidget,
    setShowSettingsDrawer,
    addSectionFromLibrary,
    moveSection,
    htmlValidationErrors,
    setSectionVisibility,
  } = useTemplateStore();

  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const handleCloseAddSectionModal = () => {
    setIsAddSectionModalOpen(false);
    setInsertAfterIndex(null);
  };

  const handleAddSectionFromLibrary = (libraryKey: string) => {
    addSectionFromLibrary(libraryKey, insertAfterIndex);
    handleCloseAddSectionModal();
  };

  // Check if a section exists in the available sections library
  const isSectionInLibrary = (sectionId: string): boolean => {
    // Check if section id exactly matches a library section id (template sections like "header-section")
    // OR if section id starts with a library section id + dash (library-added sections like "header-section-abc123")
    return Object.values(availableSections).some((section: any) => {
      const libraryId = section.id;
      // Exact match (template sections)
      if (sectionId === libraryId) {
        return true;
      }
      // Starts with library id + dash (library-added sections with nanoid)
      if (sectionId.startsWith(libraryId + "-")) {
        return true;
      }
      return false;
    });
  };

  const handleWidgetSelect = (widgetId: string, sectionId: string) => {
    setSelectedSection(sectionId);
    setSelectedWidget(widgetId);
    setShowSettingsDrawer(true);
    focusSection(sectionId, widgetId);
  };

  // Handler for drag end
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldId = pageConfig.sections.findIndex(
        (s: any) => s.id === active.id,
      );
      const newId = pageConfig.sections.findIndex(
        (s: any) => s.id === over.id,
      );
      if (oldId !== -1 && newId !== -1) {
        moveSection(active.id, over.id);
      }
    }
  };

  // Sortable Section wrapper
  function SortableSection({ section }: { section: any }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: section.id });

    const dragStyle = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: 1,
    };

    const currentBreakpoint =
      device === "mobile"
        ? "mobile"
        : device === "tablet"
          ? "tablet"
          : "desktop";

    const bpConfig =
      section.settings?.responsive?.[currentBreakpoint] || undefined;
    const isVisible =
      bpConfig && typeof bpConfig.visible === "boolean"
        ? bpConfig.visible
        : true;

    return (
      <div ref={setNodeRef}>
        <SidebarSectionGroup
          section={section}
          dragListeners={listeners}
          dragAttributes={attributes}
          dragStyle={dragStyle}
          onWidgetClick={handleWidgetSelect}
          isVisible={isVisible}
          onToggleVisibility={(sectionId) =>
            setSectionVisibility(sectionId, currentBreakpoint, !isVisible)
          }
          onAddSection={(sectionId) => {
            const index = pageConfig.sections.findIndex(
              (s: any) => s.id === sectionId,
            );
            setInsertAfterIndex(index);
            setIsAddSectionModalOpen(true);
          }}
          sectionErrors={htmlValidationErrors[section.id] || []}
          isInLibrary={isSectionInLibrary(section.id)}
          selectedWidgetId={selectedWidgetId}
        />
      </div>
    );
  }

  // Defensive: pageConfig can be momentarily null while template-scoped
  // state is being (re)loaded. Render nothing rather than dereferencing it.
  if (!pageConfig) return null;

  return (
    <>
      <SidebarScrollArea className={styles["sections-scroll"]}>
        {pageConfig.sections.length === 0 ? (
          <div className={styles["empty-state"]}>
            <p className={styles["empty-state-title"]}>No sections yet</p>
            <p className={styles["empty-state-description"]}>
              Add a section to get started
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setInsertAfterIndex(null);
                setIsAddSectionModalOpen(true);
              }}
              className={styles["empty-state-button"]}
            >
              Add section
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pageConfig.sections.map((s: any) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {pageConfig.sections.map((section: any) => (
                <SortableSection key={section.id} section={section} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </SidebarScrollArea>
      {pageConfig.sections.length > 0 && (
        <div className={styles["sections-footer"]}>
          <Button
            variant="secondary"
            size="md"
            className={styles["add-section-footer-button"]}
            onClick={() => {
              setInsertAfterIndex(null);
              setIsAddSectionModalOpen(true);
            }}
          >
            Add Section
          </Button>
        </div>
      )}

      <SectionLibraryDialog
        open={isAddSectionModalOpen}
        onConfirm={(selectedKey) => {
          if (!selectedKey) {
            return;
          }
          handleAddSectionFromLibrary(selectedKey);
        }}
        onClose={handleCloseAddSectionModal}
      />
    </>
  );
}
