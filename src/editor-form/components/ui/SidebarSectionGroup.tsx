import React from "react";
import styles from "./SidebarSectionGroup.module.css";
import { AddCircleIcon } from "./icons/AddCircleIcon";
import { DragDotsIcon } from "./icons/DragDotsIcon";
import { HtmlErrorIcon } from "./icons/HtmlErrorIcon";
import { LayoutIcon } from "./icons/LayoutIcon";
import { VisibilityIcon, VisibilityOffIcon } from "./icons/VisibilityIcon";

interface SidebarSectionGroupProps {
  section: any;
  /** Called when a widget title is clicked */
  onWidgetClick?: (widgetId: string, sectionId: string) => void;
  onToggleVisibility?: (sectionId: string) => void;
  /** Visibility for the current breakpoint */
  isVisible?: boolean;
  onAddSection?: (sectionId: string) => void;
  /** Validation errors for the section */
  sectionErrors?: any[];
  /** Whether section is in library (removable) */
  isInLibrary?: boolean;
  /** Selected widget ID for highlighting */
  selectedWidgetId?: string | null;
  /** Drag and drop props from dnd-kit */
  dragListeners?: any;
  dragAttributes?: any;
  dragStyle?: React.CSSProperties;
  className?: string;
}

/**
 * Simple, editor-only sidebar section group.
 * Renders a section with its widgets and actions.
 */
export const SidebarSectionGroup: React.FC<SidebarSectionGroupProps> = ({
  section,
  onWidgetClick,
  onToggleVisibility,
  isVisible = true,
  onAddSection,
  sectionErrors = [],
  isInLibrary: _isInLibrary = false,
  selectedWidgetId,
  dragListeners,
  dragAttributes,
  dragStyle,
  className,
}) => {
  const sectionId = section.id;
  const hasErrors = sectionErrors.length > 0;
  const isAnyWidgetSelected =
    selectedWidgetId !== null &&
    Array.isArray(section.widgets) &&
    section.widgets.some((widget: any) => widget.id === selectedWidgetId);

  const firstWidget = section.widgets?.[0];
  const groupClassName = [
    styles.group,
    hasErrors ? styles.groupError : null,
    !hasErrors && isAnyWidgetSelected ? styles.groupSelected : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleCardClick = () => {
    if (firstWidget && onWidgetClick) {
      onWidgetClick(firstWidget.id, section.id);
    }
  };

  return (
    <div className={groupClassName} style={dragStyle}>
      {firstWidget && onWidgetClick && (
        <a
          href="#"
          className={styles.stretchedLink}
          onClick={(e) => {
            e.preventDefault();
            handleCardClick();
          }}
          aria-label={`Select ${firstWidget.name || firstWidget.type || "section"}`}
        />
      )}
      <div className={styles.dragHandle} {...dragListeners} {...dragAttributes}>
        <LayoutIcon className={styles.layoutIcon} />
        <DragDotsIcon className={styles.dragIcon} />
      </div>
      <div className={styles.sectionContent}>
        <div className={styles.content}>
          {section.widgets?.map((widget: any) => {
            const isWidgetSelected = selectedWidgetId === widget.id;
            const widgetTitle = widget.name || widget.type || sectionId;

            const handleClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              onWidgetClick?.(widget.id, section.id);
            };

            return (
              <h2
                key={widget.id}
                className={styles.title}
                onClick={handleClick}
                style={{
                  cursor: onWidgetClick ? "pointer" : "default",
                  ...(isWidgetSelected
                    ? { color: "#1e40af", fontWeight: 600 }
                    : {}),
                }}
              >
                {widgetTitle}
              </h2>
            );
          })}
        </div>
      </div>
      <div className={styles.headerActions}>
        {hasErrors && (
          <div
            className={styles.errorIcon}
            title={`${sectionErrors.length} HTML validation error${sectionErrors.length !== 1 ? "s" : ""}`}
          >
            <HtmlErrorIcon />
          </div>
        )}
        {onToggleVisibility && (
          // 16px icon button, matching Figma: no extra padding, just the icon container.
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => onToggleVisibility(section.id)}
            aria-label={isVisible ? "Hide section" : "Show section"}
          >
            {isVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </button>
        )}
      </div>
      {onAddSection && (
        <button
          type="button"
          className={styles.addSectionChip}
          onClick={() => onAddSection(section.id)}
        >
          <span className={styles.addSectionIcon}>
            <AddCircleIcon />
          </span>
          <span className={styles.addSectionLabel}>Add Section</span>
        </button>
      )}
    </div>
  );
};
