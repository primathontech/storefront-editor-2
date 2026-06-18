import { useMemo } from "react";
import type { ThemeStructureTemplate } from "../../services/api";
import { useThemeStore } from "../../../stores/themeStore";
import { isUnhydratedPath } from "../../utils/preview-route";
import { Dropdown, type DropdownOptionGroup } from "./dropdown/Dropdown";

interface TemplateNode {
  id: string;
  name?: string;
  routeContext?: { path?: string; type?: string; templateName?: string };
}
interface TemplateGroup {
  name: string;
  templates?: TemplateNode[];
}

// Chrome (header/footer) lives in the theme structure for migration seeding +
// chrome-id discovery, but it isn't a standalone page — it's edited inline on
// every page. Hide it from the picker. Same signal findChromeTemplateIds uses.
const CHROME_TYPES = new Set(["header", "footer"]);
const isChromeTemplate = (t: TemplateNode): boolean =>
  CHROME_TYPES.has(t.routeContext?.type ?? t.routeContext?.templateName ?? "");

interface TemplateSwitchDropdownProps {
  onSwitchTemplate: (template: ThemeStructureTemplate) => void;
}

export const TemplateSwitchDropdown: React.FC<TemplateSwitchDropdownProps> = ({
  onSwitchTemplate,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const currentTemplate = useThemeStore((s) => s.currentTemplate);

  const optionGroups: DropdownOptionGroup[] = useMemo(() => {
    if (!theme?.templateStructure?.length) {
      return [];
    }
    return (theme.templateStructure as TemplateGroup[])
      .map((group) => ({
        label: group.name,
        options:
          group.templates
            ?.filter((template) => !isChromeTemplate(template))
            .map((template) => {
              const unhydrated = isUnhydratedPath(template.routeContext?.path);
              const baseLabel = template.name ?? template.id;
              return {
                value: template.id,
                label: unhydrated
                  ? `${baseLabel} — set sample params`
                  : baseLabel,
                disabled: unhydrated,
              };
            }) || [],
      }))
      // Drop groups left empty once chrome is filtered out (header/footer are
      // their own single-template groups, so they disappear entirely).
      .filter((group) => group.options.length > 0);
  }, [theme]);

  const findTemplate = (templateId: string) => {
    if (!theme?.templateStructure) return null;
    for (const group of theme.templateStructure as TemplateGroup[]) {
      const found = group.templates?.find((t) => t.id === templateId);
      if (found) return found;
    }
    return null;
  };

  const handleSelectChange = (nextTemplateId: string) => {
    // Re-selecting the active template would clear template-scoped state
    // without triggering a reload (the editor only reloads on id change),
    // leaving pageConfig null and crashing BuilderToolbar. No-op instead.
    if (!nextTemplateId || nextTemplateId === currentTemplate?.id) return;
    const next = findTemplate(nextTemplateId);
    if (next) onSwitchTemplate(next as ThemeStructureTemplate);
  };

  if (!theme?.templateStructure?.length || optionGroups.length === 0) {
    return null;
  }

  return (
    <Dropdown
      value={currentTemplate?.id || ""}
      onChange={handleSelectChange}
      groups={optionGroups}
      placeholder="Select template..."
      fullWidth
      variant="ghost"
    />
  );
};
