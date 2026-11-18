---
"ember-prototype-inspector": patch
---

Fix Inspect Mode failing silently in apps without a direct `@glimmer/tracking` dependency. The addon no longer declares `@glimmer/tracking` as a peer, so Embroider maps it to ember-source's implementation and tracked state re-renders the panel.

Read typography from the element that renders the text. For components such as `Hds::Button`, the panel now shows the font size and weight of `.hds-button__text` instead of the outer `<button>`, and notes which element it read from.
