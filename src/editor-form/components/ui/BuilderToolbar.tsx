import { useState, type CSSProperties } from "react";
import { Button, Input } from "./design-system";
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
import { useTemplateStore } from "../../../stores/templateStore";
import { useEditorUiStore } from "../../../stores/editorUiStore";
import styles from "./BuilderToolbar.module.css";
import { SectionLibraryDialog } from "./SectionLibraryDialog";
import { SidebarSectionGroup } from "./SidebarSectionGroup";

// A section is identified in the rail by its widget name(s) — section names/types
// are a generic fixed set (mostly CONTENT_SECTION), so search matches the widget
// label the card actually shows.
const sectionMatchesQuery = (section: any, needle: string): boolean => {
  if (!needle) {
    return true;
  }
  const widgets = Array.isArray(section.widgets) ? section.widgets : [];
  return widgets.some((w: any) =>
    String(w?.name || w?.type || "")
      .toLowerCase()
      .includes(needle)
  );
};

export default function BuilderToolbar() {
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
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleCloseAddSectionModal = () => {
    setIsAddSectionModalOpen(false);
    setInsertAfterIndex(null);
  };

  const handleAddSectionFromLibrary = (libraryKey: string) => {
    addSectionFromLibrary(libraryKey, insertAfterIndex);
    handleCloseAddSectionModal();
  };

  const handleWidgetSelect = (widgetId: string, sectionId: string) => {
    setSelectedSection(sectionId);
    setSelectedWidget(widgetId);
    setShowSettingsDrawer(true);
    focusSection(sectionId, widgetId);
  };

  const currentBreakpoint =
    device === "mobile" ? "mobile" : device === "tablet" ? "tablet" : "desktop";

  // Chrome (header/footer) groups: widgets selectable + editable, but no
  // drag / add / remove — chrome structure is fixed (omitting the drag props
  // and onAddSection disables those affordances).
  const renderChromeGroup = (section: any) => (
    <SidebarSectionGroup
      key={section.id}
      section={section}
      onWidgetClick={handleWidgetSelect}
      selectedWidgetId={selectedWidgetId}
    />
  );

  // A body section card. Drag props are supplied only in the normal (unsearched)
  // list; while searching the list is filtered, so it renders static.
  const renderBodyGroup = (
    section: any,
    dragProps?: {
      dragListeners?: unknown;
      dragAttributes?: unknown;
      dragStyle?: CSSProperties;
    }
  ) => {
    const bpConfig =
      section.settings?.responsive?.[currentBreakpoint] || undefined;
    const isVisible =
      bpConfig && typeof bpConfig.visible === "boolean"
        ? bpConfig.visible
        : true;

    return (
      <SidebarSectionGroup
        section={section}
        dragListeners={dragProps?.dragListeners}
        dragAttributes={dragProps?.dragAttributes}
        dragStyle={dragProps?.dragStyle}
        onWidgetClick={handleWidgetSelect}
        isVisible={isVisible}
        onToggleVisibility={(sectionId) =>
          setSectionVisibility(sectionId, currentBreakpoint, !isVisible)
        }
        onAddSection={(sectionId) => {
          const index = pageConfig.sections.findIndex(
            (s: any) => s.id === sectionId
          );
          setInsertAfterIndex(index);
          setIsAddSectionModalOpen(true);
        }}
        sectionErrors={htmlValidationErrors[section.id] || []}
        selectedWidgetId={selectedWidgetId}
      />
    );
  };

  // Handler for drag end
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldId = pageConfig.sections.findIndex(
        (s: any) => s.id === active.id
      );
      const newId = pageConfig.sections.findIndex((s: any) => s.id === over.id);
      if (oldId !== -1 && newId !== -1) {
        moveSection(active.id, over.id);
      }
    }
  };

  // Sortable Section wrapper
  function SortableSection({ section }: { section: any }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: section.id });

    const dragStyle: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: 1,
    };

    return (
      <div ref={setNodeRef}>
        {renderBodyGroup(section, {
          dragListeners: listeners,
          dragAttributes: attributes,
          dragStyle,
        })}
      </div>
    );
  }

  // Defensive: pageConfig can be momentarily null while template-scoped
  // state is being (re)loaded. Render nothing rather than dereferencing it.
  if (!pageConfig) return null;

  // Chrome sections (tagged with their source template id) are spliced into
  // pageConfig for editing; split them back out so the page body stays
  // draggable/addable while header/footer render as fixed groups.
  const allSections: any[] = pageConfig.sections ?? [];
  const headerSections = allSections.filter(
    (s: any) => s._chromeRole === "header"
  );
  const footerSections = allSections.filter(
    (s: any) => s._chromeRole === "footer"
  );
  const bodySections = allSections.filter((s: any) => !s._chromeTemplateId);

  const query = search.trim().toLowerCase();
  const searching = query.length > 0;
  const applySearch = (list: any[]) =>
    searching ? list.filter((s) => sectionMatchesQuery(s, query)) : list;

  const matchedHeader = applySearch(headerSections);
  const matchedFooter = applySearch(footerSections);
  const matchedBody = applySearch(bodySections);
  const noMatches =
    searching &&
    matchedHeader.length === 0 &&
    matchedBody.length === 0 &&
    matchedFooter.length === 0;

  const renderBodyList = () => {
    if (searching) {
      return matchedBody.map((section: any) => (
        <div key={section.id}>{renderBodyGroup(section)}</div>
      ));
    }
    if (bodySections.length === 0) {
      return (
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
      );
    }
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={bodySections.map((s: any) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {bodySections.map((section: any) => (
            <SortableSection key={section.id} section={section} />
          ))}
        </SortableContext>
      </DndContext>
    );
  };

  return (
    <>
      {allSections.length > 0 && (
        <div className="border-b border-[#e5e7eb] px-3 py-2">
          <Input
            type="search"
            size="md"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sections…"
            aria-label="Search sections"
            className="text-[13px]!"
          />
        </div>
      )}

      <SidebarScrollArea className={styles["sections-scroll"]}>
        {matchedHeader.map(renderChromeGroup)}

        {renderBodyList()}

        {matchedFooter.map(renderChromeGroup)}

        {noMatches && (
          <div className={styles["empty-state"]}>
            <p className={styles["empty-state-title"]}>No sections match</p>
            <p className={styles["empty-state-description"]}>
              Try a different search term.
            </p>
          </div>
        )}
      </SidebarScrollArea>
      {bodySections.length > 0 && (
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
