# Changelog

## [0.1.0](https://github.com/johnvesslyalti/inferr/compare/inferr-api-v0.0.1...inferr-api-v0.1.0) (2026-06-09)


### Features

* add chat and feed modules with controllers and services ([055861a](https://github.com/johnvesslyalti/inferr/commit/055861a2ad1ca21ae9ed07b3ad4be971358044d8))
* add database seeding functionality and new tables for articles and user interests ([27bb62f](https://github.com/johnvesslyalti/inferr/commit/27bb62f756af4fc17bfd95d2ca520796fd8f3d10))
* add feed, chat, scheduler, and API polish ([a4eb008](https://github.com/johnvesslyalti/inferr/commit/a4eb0085f5dc0e1ad60fd560e6af70e0808a0f0c))
* add onboarding, feed page, and user interests endpoint ([0732a68](https://github.com/johnvesslyalti/inferr/commit/0732a684c6321df6db2e8ddc4d0ae0673597a8a2))
* add refresh token rotation and logout ([2bd4162](https://github.com/johnvesslyalti/inferr/commit/2bd4162fbc4950490a3b6ea9d64523f54375868c))
* add user interests retrieval and update onboarding page to fetch interests ([d4f33f4](https://github.com/johnvesslyalti/inferr/commit/d4f33f4df60ab9733ccb4f1158f8bbbe2e6ea0c0))
* add workspaces configuration for apps and packages ([99d93ba](https://github.com/johnvesslyalti/inferr/commit/99d93baca4ab66756b6a36fd6240916dbbbee033))
* **auth:** persistent sessions — stay logged in until logout ([#18](https://github.com/johnvesslyalti/inferr/issues/18)) ([77ede1e](https://github.com/johnvesslyalti/inferr/commit/77ede1e0a4a759be800f61d50336964e1a2c992a))
* enhance Google authentication flow to check user interests and redirect accordingly ([6a2d2e8](https://github.com/johnvesslyalti/inferr/commit/6a2d2e8727a248d429ec0a6b4cee9d894be42467))
* **feed:** add GET /feed/debug endpoint with cosine distance scores ([1ca5387](https://github.com/johnvesslyalti/inferr/commit/1ca53872f5cb58c85583ae3959c2d33f64a8cc90))
* **feed:** relevance-filtered feed with date matching and fallback state ([#25](https://github.com/johnvesslyalti/inferr/issues/25)) ([0c7531f](https://github.com/johnvesslyalti/inferr/commit/0c7531fb652ada4337afc7dab7f79a15ae82e6a8))
* implement AI module with controller and service for article processing ([b72f34c](https://github.com/johnvesslyalti/inferr/commit/b72f34cf86a6c99de6a504032db32146c33eb61d))
* implement basic RAG pipeline with vector search and Claude integration ([da3f721](https://github.com/johnvesslyalti/inferr/commit/da3f721184a479f42ed8e0467d66be93d706d358))
* implement scraper module with controller and service for article scraping ([ca5f524](https://github.com/johnvesslyalti/inferr/commit/ca5f524d17d20fbd4c224dc5776b64f28057b71f))
* improve Google OAuth implementation with database-backed user sessions ([7fa9c99](https://github.com/johnvesslyalti/inferr/commit/7fa9c998a787889c914b1a26b861ef479e3a3500))
* integrate Bull queue for automatic scraping when no articles are found ([946c651](https://github.com/johnvesslyalti/inferr/commit/946c65188719d22b889209948a641e326fa87c94))
* limit feed to top 5 articles and clean up UI ([aaaf155](https://github.com/johnvesslyalti/inferr/commit/aaaf155e4caf3964096736158d8cf56dfc303c85))
* load environment variables from .env file in drizzle.config.ts ([8af8fc4](https://github.com/johnvesslyalti/inferr/commit/8af8fc4c773c2838c2ec15c63c31f373a3f49cee))
* **market:** tech market page with live Remotive data, ProfileMenu nav, and interests dialog ([#29](https://github.com/johnvesslyalti/inferr/issues/29)) ([e69b877](https://github.com/johnvesslyalti/inferr/commit/e69b87774c8d8dd5c8346518ca4c05e66780e04a))
* **mcp:** expose Inferr as an OAuth-secured MCP server ([#33](https://github.com/johnvesslyalti/inferr/issues/33)) ([061e517](https://github.com/johnvesslyalti/inferr/commit/061e517ecbdb5847b30504773919440da8fcc67c))
* migrate RAG service and embeddings to OpenAI API and text-embedding-3-small model ([8340ec3](https://github.com/johnvesslyalti/inferr/commit/8340ec37fde6998d258b5d324b55b99448856058))
* **rag:** replace in-memory vector store with pgvector-backed Drizzle store ([a0faeea](https://github.com/johnvesslyalti/inferr/commit/a0faeeac7d114611fac7f150c92b91a45db51a6c))
* remove access token from redirect URL ([73a00ab](https://github.com/johnvesslyalti/inferr/commit/73a00ab3b40e5f48147b7f743392f67a2c910564))
* remove RAG module and related services, update database schema, and add new snapshot ([aedbf85](https://github.com/johnvesslyalti/inferr/commit/aedbf859bba3f78fc96001788481509893eb307b))
* replace TypeORM with Drizzle ORM and wire up DB connection ([5c301d6](https://github.com/johnvesslyalti/inferr/commit/5c301d6ad768e7e8315b0d464b3577a9766a0053))
* replace UUID session token with signed JWT access token ([1030630](https://github.com/johnvesslyalti/inferr/commit/1030630291387d21ef4099a047b37235071ded44))
* **scraper:** scrape full article content for richer summaries ([#23](https://github.com/johnvesslyalti/inferr/issues/23)) ([6fd99b9](https://github.com/johnvesslyalti/inferr/commit/6fd99b9de499d393dc6cff00d3d3248ec4edc934))
* update database configuration and enhance AI and scraper controllers with GoogleTokenGuard ([b221a01](https://github.com/johnvesslyalti/inferr/commit/b221a011838a90f1d1c708b1d28ecb571bbafdbb))
* vector search debug endpoint, feed flow docs, and CI hardening ([f3529b4](https://github.com/johnvesslyalti/inferr/commit/f3529b44d540a68b7736ee9353580ae36fcd9aee))
* verify JWT signature in Next.js middleware ([1f885c6](https://github.com/johnvesslyalti/inferr/commit/1f885c6d51765bcbe3e345fb9b118dd4770cf6db))
* **web:** landing page visual polish — rounded cards with teal gradients ([#16](https://github.com/johnvesslyalti/inferr/issues/16)) ([3dc6f26](https://github.com/johnvesslyalti/inferr/commit/3dc6f2636aad000260e42c29eb5cdfcc5de85c93))


### Bug Fixes

* adjust refresh cookie sameSite policy for production and update next-env type reference path ([7dfd206](https://github.com/johnvesslyalti/inferr/commit/7dfd206051ffee4733b0241c381daa34eaa3e454))
* **api:** catch pgvector extension error on managed Postgres (Neon/Re… ([733939b](https://github.com/johnvesslyalti/inferr/commit/733939b21fa9009fe78f195d9e4925eb85152396))
* **api:** catch pgvector extension error on managed Postgres (Neon/Render) ([589878e](https://github.com/johnvesslyalti/inferr/commit/589878ebfb727aae3d1811ea17c37c608aaaeea3))
* **api:** migrate all protected endpoints from GoogleTokenGuard to JwtAuthGuard ([707b43c](https://github.com/johnvesslyalti/inferr/commit/707b43ce9588194ec70b3a4511e7bde57517c31e))
* **api:** use DATABASE_URL for DB connection when available ([6b5d0d5](https://github.com/johnvesslyalti/inferr/commit/6b5d0d53e33b2365a90ec6a9245569a756a0d3be))
* **auth:** enable partitioned cookie attribute in production ([432235d](https://github.com/johnvesslyalti/inferr/commit/432235d0e5491e32672078d915d957a820ad5b57))
* **auth:** hashed tokens, reuse detection, rate limiting ([#19](https://github.com/johnvesslyalti/inferr/issues/19)) ([b9cecf5](https://github.com/johnvesslyalti/inferr/commit/b9cecf5d32d992e6a133c85f4ee572abaf83800f))
* **auth:** remove access_token cookie from OAuth callback ([067339f](https://github.com/johnvesslyalti/inferr/commit/067339f75bb7d8b156e97bc5a706324348e39d63))
* **auth:** remove invalid cookie domain so refresh_token is actually saved ([6c1b6a5](https://github.com/johnvesslyalti/inferr/commit/6c1b6a593adf23e59487612f1583468667ffb252))
* **auth:** remove partitioned cookie attribute to fix mobile Chrome auth ([2c499e8](https://github.com/johnvesslyalti/inferr/commit/2c499e82f67128147c2f4e684920afe282373f4f))
* **auth:** remove partitioned cookie attribute to fix mobile Chrome auth ([7975376](https://github.com/johnvesslyalti/inferr/commit/79753761e34509a3d9c52826c246b9b377d70ae6))
* **auth:** replace unsafe any types with typed assertions in controller ([80e1721](https://github.com/johnvesslyalti/inferr/commit/80e17215fe1c32fae1e376786e2f2f7098736ca7))
* **auth:** update SameSite policy for production & support GET /auth/refresh redirects ([f71d3f0](https://github.com/johnvesslyalti/inferr/commit/f71d3f083e110ced7463a3f1ab010d9a84f54ca8))
* **db:** use DROP TABLE IF EXISTS in migration 0006 to avoid CI failure on fresh DB ([18eec36](https://github.com/johnvesslyalti/inferr/commit/18eec36a7624b4dcdc0642c67982f8cf611b806a))
* **docker:** fix DB connection and cookie security for local dev ([b2d4af5](https://github.com/johnvesslyalti/inferr/commit/b2d4af571b076d123264993a5e0a1eb3d6e640f3))
* ensure SSL configuration is explicitly set in drizzle config ([f72ee95](https://github.com/johnvesslyalti/inferr/commit/f72ee95082e0766a32de7319b86ced4237ddaa36))
* export GoogleTokenGuard from AuthModule and import into FeedModule and ChatModule ([a3806ea](https://github.com/johnvesslyalti/inferr/commit/a3806eaa23a9e255943f6047a5c714543a39c736))
* **lint:** resolve all 3 lint warnings across api and web ([f29312e](https://github.com/johnvesslyalti/inferr/commit/f29312e5cb585278a83dca84291a1208217a65a4))
* **migrations:** add 0002_quiet_proudstar to journal ([e4d81a9](https://github.com/johnvesslyalti/inferr/commit/e4d81a9d89ab04afa0f8902fb4c7675379daf7e1))
* run pgvector extension and migrations programmatically on startup ([f306801](https://github.com/johnvesslyalti/inferr/commit/f30680111ac161734ffb2c292cdd36d9a35cf8dd))
* **scraper:** apply review fixes from PR [#21](https://github.com/johnvesslyalti/inferr/issues/21) ([#22](https://github.com/johnvesslyalti/inferr/issues/22)) ([c5cd20d](https://github.com/johnvesslyalti/inferr/commit/c5cd20ddfd093a2bfc7cf39fc70a4efeda4fe198))


### Performance Improvements

* add HNSW vector index and partial indexes on articles ([9b1ab5c](https://github.com/johnvesslyalti/inferr/commit/9b1ab5c7383d226cbb6199e08c9f6e8b833e4016))
* **market:** persist market report in Postgres instead of memory ([#32](https://github.com/johnvesslyalti/inferr/issues/32)) ([52a38c7](https://github.com/johnvesslyalti/inferr/commit/52a38c74aac4dcc983107600df4cc2140f41ee44))
