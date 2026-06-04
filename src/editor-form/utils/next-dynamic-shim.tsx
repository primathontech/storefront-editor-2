/**
 * next/dynamic shim for the Vite SPA.
 *
 * The editor's heavy fields (HtmlEditor wrapping Monaco, RichTextInput
 * wrapping ReactQuill) used Next's dynamic() for client-only loading.
 * In Vite there is no SSR — every chunk is client. We translate the
 * same API to React.lazy + Suspense so the copied source compiles
 * unchanged.
 */
import {
  Suspense,
  lazy,
  type ComponentType,
  type ReactNode,
} from "react";

interface DynamicOptions {
  ssr?: boolean;
  loading?: () => ReactNode;
}

// Return type stays loose — callers (RichTextInput, HtmlInput) pass props
// straight through to the underlying component, which has its own typings.
export default function dynamic(
  loader: () => Promise<any>,
  opts: DynamicOptions = {},
): ComponentType<any> {
  const Lazy = lazy(async () => {
    const mod = await loader();
    const component: ComponentType<any> = mod.default ?? mod;
    return { default: component };
  });

  const fallback = opts.loading ? opts.loading() : null;

  const Wrapped: ComponentType<any> = (props) => (
    <Suspense fallback={fallback}>
      <Lazy {...props} />
    </Suspense>
  );
  Wrapped.displayName = "DynamicLazy";
  return Wrapped;
}
