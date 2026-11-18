# ember-prototype-kit

Reusable tooling for building Ember prototypes with the
[Helios Design System](https://helios.hashicorp.design).

| Package                                                          | Description                                                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`ember-prototype-inspector`](packages/ember-prototype-inspector) | Inspect Mode: click any element to see its template source, invocation, tokens and spacing. |

`test-app/` is a Vite and Embroider app that demonstrates and tests the
packages.

## Development

Requires Node 22 (see `.nvmrc`) and pnpm 10. If `pnpm` isn't on your PATH, run
it through Corepack (`corepack pnpm ...`).

```sh
pnpm install
pnpm start   # run the demo app
pnpm lint
pnpm test
pnpm build
```

## Releasing

Packages are versioned with [Changesets](https://github.com/changesets/changesets).
Run `pnpm changeset` to describe a change. On `main`, the release workflow opens
a "Version packages" pull request and publishes to npm when it's merged.

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers),
so no npm token is stored in the repository. Each package must list this
repository and `release.yml` as a trusted publisher on npmjs.com, with direct
`npm publish` allowed. Trusted publishers can only be added to a package that
already exists, so a new package's first version is published manually.

## License

MIT
