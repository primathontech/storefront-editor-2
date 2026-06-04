import { useMemo } from "react";
import type { ThemeStructureTemplate } from "../../services/api";
import { useThemeStore } from "../../../stores/themeStore";
import { isUnhydratedPath } from "../../utils/preview-route";
import { Dropdown, type DropdownOptionGroup } from "./dropdown/Dropdown";

interface TemplateNode {
  id: string;
  name?: string;
  routeContext?: { path?: string };
}
interface TemplateGroup {
  name: string;
  templates?: TemplateNode[];
}

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
    return (theme.templateStructure as TemplateGroup[]).map((group) => ({
      label: group.name,
      options:
        group.templates?.map((template) => {
          const unhydrated = isUnhydratedPath(template.routeContext?.path);
          const baseLabel = template.name ?? template.id;
          return {
            value: template.id,
            label: unhydrated ? `${baseLabel} — set sample params` : baseLabel,
            disabled: unhydrated,
          };
        }) || [],
    }));
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
    if (!nextTemplateId) return;
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
