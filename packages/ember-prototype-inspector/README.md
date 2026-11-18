# ember-prototype-inspector

Inspect Mode for Ember prototypes. Click any rendered element to see:

- the component or element name and the template file and line that rendered it
- the full invocation, including authored `@arguments`
- rendered component properties and icons
- the design tokens, typography, spacing and dimensions applied to it
  (typography is read from the descendant that renders the text, such as
  `.hds-button__text`, when the selected element has no text of its own)
- a link to the component's documentation
- reviewer guidance written by the prototype author

It is designed for apps built with the
[Helios Design System](https://helios.hashicorp.design) (HDS), but the
component naming, token prefixes and documentation links are configurable.

The package has two parts:

1. **A template transform.** At build time it stamps `data-inspect-*`
   attributes onto every element and component invocation in your templates.
   It works with `.gts`/`.gjs` template-tag components and `.hbs` templates.
2. **An `<InspectMode>` component.** It reads those attributes and the
   computed styles from the live DOM and shows them in a panel.

## Compatibility

- Ember 5.12 or later (tested with 6.12)
- Vite and Embroider, or any build that compiles templates with
  `babel-plugin-ember-template-compilation` (tested with 3.x and 4.x)
- `@hashicorp/design-system-components` 6.5 or 7.x (the panel UI uses HDS)
- Node 20.19 or later

The addon imports `@glimmer/tracking` from ember-source. Apps don't need a
direct `@glimmer/tracking` dependency.

## Install

```sh
pnpm add -D ember-prototype-inspector
```

## Configure the template transform

Register the transform in `babel.config.mjs`, after any other template
transforms:

```js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templateCompatSupport } from '@embroider/compat/babel';
import inspectMetadata from 'ember-prototype-inspector/template-transform';

const root = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [
    [
      'babel-plugin-ember-template-compilation',
      {
        transforms: [
          ...templateCompatSupport(),
          inspectMetadata({
            root,
            enabled: process.env.INSPECT_METADATA !== 'false',
          }),
        ],
      },
    ],
    // ...the rest of your plugins
  ],
};
```

You can also register it by module path:

```js
transforms: [['ember-prototype-inspector/template-transform', { root }]];
```

No Vite configuration is needed beyond the standard `@embroider/vite` setup.

### Transform options

| Option                | Default                       | Description                                                                                                                    |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`             | `true`                        | Set to `false` to build without metadata, for example in production.                                                          |
| `root`                | `process.cwd()`               | Directory that source paths are relative to.                                                                                   |
| `sourcePrefix`        | `''`                          | Prepended to every source path.                                                                                                |
| `include`             | `[]`                          | When set, only stamp templates whose absolute path matches one of these strings, regular expressions or functions.            |
| `exclude`             | `[/[\\/]node_modules[\\/]/]`  | Skip templates whose absolute path matches. The inspector's own templates are always skipped.                                 |
| `namespaces`          | `{ Hds: 'Hds::' }`            | Maps an authored tag prefix to a display namespace. `<HdsButton>` and `<Hds::Button>` both become `Hds::Button`.              |
| `localNamespace`      | `''`                          | Prefix for components that match no namespace. For example, `'App::'` shows `<Card>` as `App::Card`.                          |
| `contextualNamespace` | `'Contextual::'`              | Prefix for yielded components such as `<A.Title>`.                                                                             |
| `elementNamespace`    | `'HTML::'`                    | Prefix for HTML elements without a static class.                                                                               |
| `customNamespace`     | `'Custom::'`                  | Prefix for HTML elements, which are named after their first static class.                                                     |
| `skipTags`            | `[]`                          | Extra tag names never to stamp. `html`, `head`, `script`, `style`, `template` and similar tags are always skipped.            |
| `componentName`       | none                          | `(info) => string \| undefined`. Overrides the generated name. `info` has `tag`, `kind`, `classes` and `filename`.             |

### What gets stamped

| Attribute                 | Example                                       |
| ------------------------- | --------------------------------------------- |
| `data-inspect-component`  | `Hds::Button`                                 |
| `data-inspect-source`     | `app/components/summary.gts:12`               |
| `data-inspect-invocation` | URI-encoded opening tag, as authored          |
| `data-inspect-arguments`  | URI-encoded JSON array of authored `@args`    |
| `data-inspect-id`         | `app/components/summary.gts:12:4`             |

Line and column numbers refer to the original file, including for
`<template>` blocks inside `.gts` and `.gjs` files.

Attributes you write yourself always win over generated ones. Use this to give
a composition a clearer name or source when the generated value would be
misleading. Add `data-inspect-skip` to an element to leave it unstamped; the
attribute is removed from the output.

## Render Inspect Mode

Import the component and render it while inspection is on:

```gts
import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import InspectMode from 'ember-prototype-inspector/components/inspect-mode';

export default class Layout extends Component {
  @tracked inspecting = false;

  stopInspecting = () => (this.inspecting = false);

  <template>
    {{yield}}

    {{#if this.inspecting}}
      <InspectMode @onExit={{this.stopInspecting}} />
    {{/if}}
  </template>
}
```

In classic `.hbs` templates the component is available as `<InspectMode>`.

A query parameter such as `?inspect=true` is a convenient way to turn it on.
See `test-app/app/controllers/application.ts` in this repository for an
example.

The component imports its own stylesheet. The styles use HDS 7 tokens and
fall back to HDS 6 tokens.

### Component arguments

| Argument         | Default                    | Description                                                                                                 |
| ---------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@onExit`        | required                   | Called when the user presses Escape.                                                                        |
| `@docsUrl`       | `hdsDocsUrl`               | `(component: string) => string \| null`. Returns a documentation URL for a component name, or `null`.       |
| `@docsLabel`     | `'Documentation'`          | Text for the documentation link.                                                                            |
| `@tokenPrefixes` | `['--hds-', '--token-']`   | CSS custom property prefixes reported as design tokens.                                                     |

`hdsDocsUrl` links `Hds::*` components to their pages on
helios.hashicorp.design. To add links for your own components, wrap it:

```ts
import { hdsDocsUrl } from 'ember-prototype-inspector';

export const docsUrl = (component: string) =>
  component.startsWith('App::')
    ? `https://example.com/components/${component.slice(5)}`
    : hdsDocsUrl(component);
```

## Using Inspect Mode

- Click an element to inspect it. Hovering shows its name.
- Use the breadcrumbs to select a parent component.
- Alt-click when the underlying control must stay interactive.
- Press Escape to exit.

## Component requirements

Custom components must forward `...attributes` to the element that represents
the component boundary:

```gts
<template>
  <section class="summary" ...attributes>
    ...
  </section>
</template>
```

The transform stamps metadata onto the component invocation. Without
`...attributes`, that metadata never reaches the DOM and the component can't
be selected as a whole. If a component has several root elements, forward
attributes to the one that represents the component.

## Reviewer guidance

Generated metadata explains what was rendered, not why. Add
`data-inspect-note` to important custom compositions when reviewers need
context:

```gts
<section
  class="change-review"
  data-inspect-note="Added and removed items are grouped so reviewers can compare them."
  ...attributes
>
  ...
</section>
```

Update or remove the note whenever the behavior changes. Don't repeat
information already visible in arguments or computed styles.

## Validation workflow

For every meaningful UI change:

1. Open the affected route in the state you changed.
2. Turn on Inspect Mode.
3. Select the changed component or custom composition.
4. Confirm the component name, source location and invocation.
5. Confirm the arguments, icons, typography, spacing and tokens.
6. Confirm any guidance note still describes the current behavior.
7. Repeat for materially different states, such as permission, error, empty
   and loading states.

Inspect Mode only describes elements in the current DOM. Conditional content
must be rendered before you can inspect it.

## Testing

Assert on the information reviewers rely on:

```ts
await visit('/?inspect=true');
await click('[data-inspect-component="Hds::PageHeader"]');

assert.dom('[data-test-inspect-panel] h2').hasText('Hds::PageHeader');
assert
  .dom('[data-test-inspect-source]')
  .hasText(/^app\/templates\/index\.gts:\d+$/);
assert
  .dom('[data-test-inspect-invocation]')
  .includesText('<HdsPageHeader');
```

Other test selectors: `data-test-inspect-close`, `data-test-inspect-note`,
`data-test-inspect-docs` and `data-test-copy-inspect-invocation`.

When a composition has a `data-inspect-note`, assert the guidance that must
stay accurate.

## Known limitations

- Components that don't forward `...attributes` lose invocation metadata.
- Elements created by JavaScript, portals or other uncompiled rendering paths
  need explicit `data-inspect-*` attributes.
- Hidden and unrendered states can't be inspected.
- Source references point to the template invocation, not the component's
  JavaScript or TypeScript class.
- Token reporting depends on stylesheets the browser has loaded and can read.
- If a file contains two identical `<template>` blocks, both report the line
  of the first one.

## Pull request checklist

- [ ] Changed component boundaries can still be selected.
- [ ] Custom components forward `...attributes`.
- [ ] Source and invocation details identify the changed template.
- [ ] `data-inspect-note` guidance matches the current behavior.
- [ ] Relevant states were inspected.
- [ ] Inspect Mode tests were added or updated where needed.

## License

MIT
