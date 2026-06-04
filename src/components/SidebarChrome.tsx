import { Dropdown } from "../editor-form/components/ui/design-system";
import { useThemeStore } from "../stores/themeStore";

// Theme-scoped chrome strip at the top of the left sidebar. Page title +
// locale dropdown — both derive from themeStore directly so lanes don't
// have to wire them. Position matches the old submodule.

export const SidebarChrome = () => {
  const currentTemplate = useThemeStore((s) => s.currentTemplate);
  const language = useThemeStore((s) => s.language);
  const setLanguage = useThemeStore((s) => s.setLanguage);
  const supportedLanguages = useThemeStore(
    (s) => s.currentTemplate?.supportedLanguages ?? ["en"],
  );

  return (
    <div className="border-b-[0.5px] border-editor-border">
      <div className="px-2 py-3">
        <span className="text-base font-semibold leading-5 text-editor-text">
          {currentTemplate?.name || currentTemplate?.id || "Untitled Page"}
        </span>
      </div>
      {supportedLanguages.length > 1 && (
        <div className="px-2 pb-3">
          <Dropdown
            options={supportedLanguages.map((lng) => ({
              value: lng,
              label: lng.toUpperCase(),
            }))}
            value={language}
            onChange={setLanguage}
            placeholder="Select Language"
            fullWidth
          />
        </div>
      )}
    </div>
  );
};
