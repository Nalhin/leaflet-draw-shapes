# Contributing

Thanks for helping out! For anything bigger than a small fix, please open an
issue first so we can agree on the approach.

Please note we have a [code of conduct](CODE_OF_CONDUCT.md); please follow it
in all your interactions with the project.

## Setup

You need Node.js 24+ and [pnpm](https://pnpm.io) (the version is pinned in
`package.json`).

```sh
pnpm install
pnpm dev     # interactive demo using the source directly
pnpm test    # or `pnpm test:watch`
pnpm check   # everything CI runs: lint, format, typecheck, test, build
```

## Pull requests

1. Add or update tests in `test/` for any behaviour change.
2. Update `README.md` for API changes, and add an entry under
   `[Unreleased]` in `CHANGELOG.md`.
3. Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
   for commit messages.
4. Make sure `pnpm check` passes.

## Releasing

The version is taken from the Git tag, so `package.json` keeps the placeholder
`0.0.0-development`. To release:

1. Move the `[Unreleased]` changelog entries under the new version and merge to
   `main`.
2. Create a GitHub Release with a `vX.Y.Z` tag:

   ```sh
   gh release create v2.0.0 --generate-notes
   ```

   Mark it as a pre-release (or use a tag like `v2.1.0-beta.1` with
   `--prerelease`) to publish under the `next` npm dist-tag.

3. The [Release workflow](.github/workflows/release.yml) runs `pnpm check`,
   stamps the version and publishes to npm with provenance.

### One-time setup

- **npm trusted publishing.** On npmjs.com, open the package's Settings, then
  Trusted publishing, and add a GitHub Actions publisher with owner `Nalhin`,
  repository `leaflet-draw-shapes`, workflow `release.yml` and environment
  `npm`. No `NPM_TOKEN` secret is needed.
- **GitHub Pages.** In the repo's Settings, open Pages and set Source to
  "GitHub Actions" so the demo deploys from `main`.
