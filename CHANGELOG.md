# Changelog

## [0.2.0](https://github.com/devenney/rss-to-social/compare/rss-to-social-v0.1.0...rss-to-social-v0.2.0) (2026-06-15)


### Features

* add User-Agent header to RSS fetch for WAF allowlisting ([c2e9d74](https://github.com/devenney/rss-to-social/commit/c2e9d749b606ae9a7eaf1228511cdd30c3cff0a8))
* initial implementation ([513d553](https://github.com/devenney/rss-to-social/commit/513d55320d3e70a31be2c911e2db537f08b4ce56))
* remove Dev.to adapter — use native RSS import instead ([69264f3](https://github.com/devenney/rss-to-social/commit/69264f31b5abd346aefff8de19059da8354d2a3d))


### Bug Fixes

* remove deploy job from CI (Workers Builds handles deploy) ([54394b8](https://github.com/devenney/rss-to-social/commit/54394b8cb3e94a8bfa4d95b7d8bdabffe5a0bf1a))
* use wrangler.deploy:cf for Workers Builds (wrangler.personal.toml not in repo) ([43f35eb](https://github.com/devenney/rss-to-social/commit/43f35ebeab45a49ef13fecb5b1c415bad561eaec))
* wrap default fetch to preserve Workers runtime this binding ([61b1a3d](https://github.com/devenney/rss-to-social/commit/61b1a3d038bdcab04cf4b97da99894ddac218f8e))
