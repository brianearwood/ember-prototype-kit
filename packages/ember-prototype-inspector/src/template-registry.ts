import type InspectMode from './components/inspect-mode.gts';
import type positionInspectOverlay from './modifiers/position-inspect-overlay.ts';

// Loose-mode (.hbs) Glint registry. Strict-mode (.gts) consumers import the
// component directly and do not need this.
export default interface Registry {
  InspectMode: typeof InspectMode;
  'position-inspect-overlay': typeof positionInspectOverlay;
}
