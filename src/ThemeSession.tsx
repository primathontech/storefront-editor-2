import { useMachine } from "@xstate/react";
import { fromPromise } from "xstate";
import { FullPageMessage } from "./components/FullPageMessage";
import CodeEditor from "./editor-form/containers/CodeEditor";
import TemplateEditor from "./editor-form/containers/TemplateEditor";
import TranslationEditor from "./editor-form/containers/TranslationEditor";
import { EditorAPI } from "./editor-form/services/api";
import {
  themeSessionMachine,
  type ThemeStructure,
  type ThemeStructureTemplate,
} from "./machines/themeSession";
import { useAuthStore } from "./stores/authStore";
import { useEditorUiStore } from "./stores/editorUiStore";
import { useTemplateStore } from "./stores/templateStore";
import { useThemeStore } from "./stores/themeStore";
import { useTranslationStore } from "./stores/translationStore";

const pickDefaultTemplate = (
  structure: ThemeStructure,
): ThemeStructureTemplate | null => {
  const groups = structure.templateStructure ?? [];
  const homeGroup = groups.find(
    (g) =>
      (g as { routePattern?: string }).routePattern === "/" ||
      (g as { type?: string }).type === "home",
  );
  return homeGroup?.templates?.[0] ?? groups[0]?.templates?.[0] ?? null;
};

const providedThemeSessionMachine = themeSessionMachine.provide({
  actors: {
    fetchThemeStructure: fromPromise<ThemeStructure, { themeId: string }>(
      ({ input }) => EditorAPI.getThemeStructure(input.themeId),
    ),
  },
  actions: {
    setTheme: (_, params) => {
      const { theme } = params as { theme: ThemeStructure };
      useThemeStore.getState().setTheme(theme);
    },
    selectDefaultTemplate: () => {
      const theme = useThemeStore.getState().theme;
      if (!theme) return;
      const next = pickDefaultTemplate(theme);
      if (next) useThemeStore.getState().setCurrentTemplate(next);
    },
    clearTemplateScopedState: () => {
      useTemplateStore.getState().reset();
      useTranslationStore.getState().reset();
    },
    setCurrentTemplate: (_, params) => {
      const { template } = params as { template: ThemeStructureTemplate };
      useThemeStore.getState().setCurrentTemplate(template);
    },
  },
});

const ThemeSession = () => {
  // Mounted only when appBoot.matches('authenticated').
  const merchant = useAuthStore.getState().merchant!;
  const [state, send] = useMachine(providedThemeSessionMachine, {
    input: { merchant },
  });

  const currentTemplate = useThemeStore((s) => s.currentTemplate);
  const view = useEditorUiStore((s) => s.view);

  if (state.matches("bootingTheme")) {
    return <FullPageMessage title="Loading theme…" spinner />;
  }
  if (state.matches("errorLoadingTheme")) {
    return (
      <FullPageMessage
        title="Couldn't load theme"
        subtitle="We couldn't fetch this merchant's theme structure. Please try again."
        onRetry={() => send({ type: "RETRY" })}
      />
    );
  }
  if (!currentTemplate) return null;

  const onSwitchTemplate = (template: ThemeStructureTemplate) =>
    send({ type: "SWITCH_TEMPLATE", template });

  // Visual and Code are mutually exclusive surfaces (locked decision #8).
  // The visual surface unmounts entirely in Code mode (plan §10.13 —
  // saves the iframe's memory; Visual re-boots on switch back).
  if (view === "code") {
    return <CodeEditor onSwitchTemplate={onSwitchTemplate} />;
  }

  return currentTemplate.isDynamic ? (
    <TemplateEditor onSwitchTemplate={onSwitchTemplate} />
  ) : (
    <TranslationEditor onSwitchTemplate={onSwitchTemplate} />
  );
};

export default ThemeSession;
