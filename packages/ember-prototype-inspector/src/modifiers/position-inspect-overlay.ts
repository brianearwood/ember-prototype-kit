import { modifier } from 'ember-modifier';

export interface Bounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface PositionInspectOverlaySignature {
  Element: HTMLElement;
  Args: {
    Named: {
      label?: boolean;
    };
    Positional: [Bounds | null];
  };
}

const positionInspectOverlay = modifier<PositionInspectOverlaySignature>(
  (element, [bounds], { label = false }) => {
    if (!bounds) {
      return;
    }

    element.style.left = `${bounds.left}px`;
    element.style.top = `${label ? Math.max(4, bounds.top - 25) : bounds.top}px`;

    if (!label) {
      element.style.width = `${bounds.width}px`;
      element.style.height = `${bounds.height}px`;
    }
  },
);

export default positionInspectOverlay;
