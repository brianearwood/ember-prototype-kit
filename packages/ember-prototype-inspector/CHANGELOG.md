# ember-prototype-inspector

## 0.1.1
### Patch Changes



- [#5](https://github.com/brianearwood/ember-prototype-kit/pull/5) [`7bb20b3`](https://github.com/brianearwood/ember-prototype-kit/commit/7bb20b3367667521aa88a038cfcf252521bfef5d) Thanks [@brianearwood](https://github.com/brianearwood)! - Fix Inspect Mode failing silently in apps without a direct `@glimmer/tracking` dependency. The addon no longer declares `@glimmer/tracking` as a peer, so Embroider maps it to ember-source's implementation and tracked state re-renders the panel.
  
  Read typography from the element that renders the text. For components such as `Hds::Button`, the panel now shows the font size and weight of `.hds-button__text` instead of the outer `<button>`, and notes which element it read from.

## 0.1.0
### Minor Changes



- [#1](https://github.com/brianearwood/ember-prototype-kit/pull/1) [`49e5018`](https://github.com/brianearwood/ember-prototype-kit/commit/49e5018bd1e1f9ac4ac64a2592c3d06bfe8d59bb) Thanks [@brianearwood](https://github.com/brianearwood)! - Initial release: Inspect Mode component, overlay modifier, HDS docs resolver,
  and a Glimmer template transform that stamps inspect metadata into
  templates compiled by babel-plugin-ember-template-compilation (Vite/Embroider).
