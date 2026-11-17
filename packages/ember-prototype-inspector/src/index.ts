export {
  default as InspectMode,
  DEFAULT_TOKEN_PREFIXES,
  type InspectModeSignature,
} from './components/inspect-mode.gts';
export {
  default as positionInspectOverlay,
  type Bounds,
} from './modifiers/position-inspect-overlay.ts';
export {
  hdsDocsUrl,
  HDS_DOCS_BASE_URL,
  type DocsUrlResolver,
} from './docs-url.ts';
export type {
  ComponentProperty,
  InspectionValue,
  InspectTarget,
  TokenReference,
} from './inspect.ts';
