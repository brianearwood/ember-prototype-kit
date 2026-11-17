export const HDS_DOCS_BASE_URL = 'https://helios.hashicorp.design';

/**
 * Resolves a documentation URL for an inspected component name, or `null`
 * when none is available.
 */
export type DocsUrlResolver = (component: string) => string | null;

// HDS families documented under `components/<family>/<variant>`.
const NESTED_FAMILIES = new Set(['copy', 'form', 'link', 'pagination']);

// Multi-word HDS families, longest first, so concatenated tags such as
// `HdsAppSideNav` resolve to `app-side-nav` instead of `app`.
const MULTI_WORD_FAMILIES = [
  'advanced-table',
  'application-state',
  'app-side-nav',
  'app-footer',
  'app-header',
  'app-frame',
  'badge-count',
  'button-set',
  'code-block',
  'code-editor',
  'filter-bar',
  'icon-tile',
  'page-header',
  'rich-tooltip',
  'segmented-group',
  'theme-switcher',
].sort((a, b) => b.length - a.length);

// Form sub-components share one docs page per control.
const FORM_SUFFIX = /-(field|base|group)(-.*)?$/;

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Default resolver: maps `Hds::*` component names to pages on
 * helios.hashicorp.design. Non-HDS names resolve to `null`.
 */
export function hdsDocsUrl(component: string): string | null {
  if (!component.startsWith('Hds::')) {
    return null;
  }

  const segments = component
    .slice('Hds::'.length)
    .split('::')
    .map(kebabCase)
    .filter(Boolean);
  const joined = segments.join('-');

  if (!joined) {
    return null;
  }

  if (joined.startsWith('layout-')) {
    return `${HDS_DOCS_BASE_URL}/layouts/${joined.slice('layout-'.length).split('-')[0]}`;
  }

  const multiWord = MULTI_WORD_FAMILIES.find(
    (family) => joined === family || joined.startsWith(`${family}-`),
  );
  const family = multiWord ?? joined.split('-')[0]!;
  const rest = joined.slice(family.length + 1);

  if (!NESTED_FAMILIES.has(family) || !rest) {
    return `${HDS_DOCS_BASE_URL}/components/${family}`;
  }

  const variant =
    family === 'form' ? rest.replace(FORM_SUFFIX, '') : rest.split('-')[0]!;

  return `${HDS_DOCS_BASE_URL}/components/${family}/${variant}`;
}
