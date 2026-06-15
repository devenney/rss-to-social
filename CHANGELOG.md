# Changelog

## [2.0.0](https://github.com/devenney/rss-to-social/compare/v1.0.0...v2.0.0) (2026-06-15)


### ⚠ BREAKING CHANGES

* deployment now requires wrangler.personal.toml (run npm run setup). Workers Builds approach removed. GitHub Actions auto-deploy re-added.

### Features

* add setup script to auto-create KV namespaces and generate wrangler.personal.toml ([5fe1f18](https://github.com/devenney/rss-to-social/commit/5fe1f186f6efe7f4d5869cfcf159019abcdf1806))
* add User-Agent header to RSS fetch for WAF allowlisting ([c2e9d74](https://github.com/devenney/rss-to-social/commit/c2e9d749b606ae9a7eaf1228511cdd30c3cff0a8))
* initial implementation ([513d553](https://github.com/devenney/rss-to-social/commit/513d55320d3e70a31be2c911e2db537f08b4ce56))
* remove Dev.to adapter — use native RSS import instead ([69264f3](https://github.com/devenney/rss-to-social/commit/69264f31b5abd346aefff8de19059da8354d2a3d))
* stable release — wrangler CLI deployment, auto-bootstrap, Bluesky + Mastodon ([d9ec75a](https://github.com/devenney/rss-to-social/commit/d9ec75a934b39fffa88e73da2c99d69812311f3d))


### Bug Fixes

* add keep_vars to preserve dashboard config across deployments ([61e8a65](https://github.com/devenney/rss-to-social/commit/61e8a65052624ab89da294ef8abaaeb57edfbf66))
* pass Cloudflare credentials as env vars rather than wrangler-action inputs ([2886e68](https://github.com/devenney/rss-to-social/commit/2886e68649acd102d1900441301bbfe210d5ad37))
* remove deploy job from CI (Workers Builds handles deploy) ([54394b8](https://github.com/devenney/rss-to-social/commit/54394b8cb3e94a8bfa4d95b7d8bdabffe5a0bf1a))
* use wrangler.deploy:cf for Workers Builds (wrangler.personal.toml not in repo) ([43f35eb](https://github.com/devenney/rss-to-social/commit/43f35ebeab45a49ef13fecb5b1c415bad561eaec))
* wrap default fetch to preserve Workers runtime this binding ([61b1a3d](https://github.com/devenney/rss-to-social/commit/61b1a3d038bdcab04cf4b97da99894ddac218f8e))

## [1.0.0](https://github.com/devenney/rss-to-social/compare/v0.3.0...v1.0.0) (2026-06-15)


### ⚠ BREAKING CHANGES

* deployment now requires wrangler.personal.toml (run npm run setup). Workers Builds approach removed. GitHub Actions auto-deploy re-added.

### Features

* stable release — wrangler CLI deployment, auto-bootstrap, Bluesky + Mastodon ([d9ec75a](https://github.com/devenney/rss-to-social/commit/d9ec75a934b39fffa88e73da2c99d69812311f3d))


### Bug Fixes

* pass Cloudflare credentials as env vars rather than wrangler-action inputs ([2886e68](https://github.com/devenney/rss-to-social/commit/2886e68649acd102d1900441301bbfe210d5ad37))

## [0.3.0](https://github.com/devenney/rss-to-social/compare/v0.2.0...v0.3.0) (2026-06-15)


### Features

* add setup script to auto-create KV namespaces and generate wrangler.personal.toml ([5fe1f18](https://github.com/devenney/rss-to-social/commit/5fe1f186f6efe7f4d5869cfcf159019abcdf1806))
* add User-Agent header to RSS fetch for WAF allowlisting ([c2e9d74](https://github.com/devenney/rss-to-social/commit/c2e9d749b606ae9a7eaf1228511cdd30c3cff0a8))
* initial implementation ([513d553](https://github.com/devenney/rss-to-social/commit/513d55320d3e70a31be2c911e2db537f08b4ce56))
* remove Dev.to adapter — use native RSS import instead ([69264f3](https://github.com/devenney/rss-to-social/commit/69264f31b5abd346aefff8de19059da8354d2a3d))


### Bug Fixes

* add keep_vars to preserve dashboard config across deployments ([61e8a65](https://github.com/devenney/rss-to-social/commit/61e8a65052624ab89da294ef8abaaeb57edfbf66))
* remove deploy job from CI (Workers Builds handles deploy) ([54394b8](https://github.com/devenney/rss-to-social/commit/54394b8cb3e94a8bfa4d95b7d8bdabffe5a0bf1a))
* use wrangler.deploy:cf for Workers Builds (wrangler.personal.toml not in repo) ([43f35eb](https://github.com/devenney/rss-to-social/commit/43f35ebeab45a49ef13fecb5b1c415bad561eaec))
* wrap default fetch to preserve Workers runtime this binding ([61b1a3d](https://github.com/devenney/rss-to-social/commit/61b1a3d038bdcab04cf4b97da99894ddac218f8e))

## [0.2.0](https://github.com/devenney/rss-to-social/compare/rss-to-social-v0.1.0...rss-to-social-v0.2.0) (2026-06-15)


### Features

* add User-Agent header to RSS fetch for WAF allowlisting ([c2e9d74](https://github.com/devenney/rss-to-social/commit/c2e9d749b606ae9a7eaf1228511cdd30c3cff0a8))
* initial implementation ([513d553](https://github.com/devenney/rss-to-social/commit/513d55320d3e70a31be2c911e2db537f08b4ce56))
* remove Dev.to adapter — use native RSS import instead ([69264f3](https://github.com/devenney/rss-to-social/commit/69264f31b5abd346aefff8de19059da8354d2a3d))


### Bug Fixes

* remove deploy job from CI (Workers Builds handles deploy) ([54394b8](https://github.com/devenney/rss-to-social/commit/54394b8cb3e94a8bfa4d95b7d8bdabffe5a0bf1a))
* use wrangler.deploy:cf for Workers Builds (wrangler.personal.toml not in repo) ([43f35eb](https://github.com/devenney/rss-to-social/commit/43f35ebeab45a49ef13fecb5b1c415bad561eaec))
* wrap default fetch to preserve Workers runtime this binding ([61b1a3d](https://github.com/devenney/rss-to-social/commit/61b1a3d038bdcab04cf4b97da99894ddac218f8e))
