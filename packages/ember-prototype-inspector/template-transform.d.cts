export interface InspectElementInfo {
  /** Static class names authored on the element, in order. */
  classes: string[];
  /** Absolute path of the template being compiled, when known. */
  filename: string | null;
  /**
   * `component` for `<Foo>`, `<Foo::Bar>`, `<@foo>` invocations;
   * `contextual` for `<f.Field>`-style yielded components;
   * `element` for plain HTML/SVG elements.
   */
  kind: 'component' | 'contextual' | 'element';
  /** The tag exactly as authored. */
  tag: string;
}

export interface InspectMetadataOptions {
  /**
   * Set to `false` to skip stamping entirely (for example in production
   * builds). Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Directory that `data-inspect-source` paths are relative to. Defaults to
   * `process.cwd()`.
   */
  root?: string;
  /** String prepended to every relative source path. Defaults to `''`. */
  sourcePrefix?: string;
  /**
   * When non-empty, only templates whose absolute filename matches one of
   * these patterns are stamped.
   */
  include?: Array<string | RegExp | ((filename: string) => boolean)>;
  /**
   * Templates whose absolute filename matches any of these patterns are not
   * stamped. Defaults to `[/[\\/]node_modules[\\/]/]`. The inspector's own
   * templates are always excluded.
   */
  exclude?: Array<string | RegExp | ((filename: string) => boolean)>;
  /**
   * Maps an authored tag prefix to a display namespace. `<HdsButton>` and
   * `<Hds::Button>` both become `Hds::Button` with the default
   * `{ Hds: 'Hds::' }`.
   */
  namespaces?: Record<string, string>;
  /** Prefix for components that match no namespace. Defaults to `''`. */
  localNamespace?: string;
  /** Prefix for yielded components. Defaults to `'Contextual::'`. */
  contextualNamespace?: string;
  /** Prefix for HTML elements without a static class. Defaults to `'HTML::'`. */
  elementNamespace?: string;
  /** Prefix for HTML elements named after their first static class. Defaults to `'Custom::'`. */
  customNamespace?: string;
  /** Additional lowercase tag names that should never be stamped. */
  skipTags?: string[];
  /**
   * Override the generated `data-inspect-component` value. Return `undefined`
   * to fall back to the default naming.
   */
  componentName?: (info: InspectElementInfo) => string | undefined;
}

export type InspectMetadataPlugin = (env: unknown) => {
  name: string;
  visitor: Record<string, unknown>;
};

declare function inspectMetadataTransform(
  options?: InspectMetadataOptions,
): InspectMetadataPlugin;

declare namespace inspectMetadataTransform {
  export { inspectMetadataTransform, inspectMetadataTransform as default };
  export const ATTRIBUTE_NAMES: readonly string[];
  export const PLUGIN_NAME: string;
}

export = inspectMetadataTransform;
