# The study server in one container (docs/DEPLOYMENT.md §8): the built app, /api/thinker, the
# session-log upload and the researcher's data download, as `npm run serve` runs them.
#
#   docker build --build-arg APP_COMMIT=$(git rev-parse --short=12 HEAD) -t fire-sim .
#   docker run -p 8080:8080 -v fire-sim-logs:/app/logs -e GEMINI_API_KEY -e ADMIN_TOKEN fire-sim
#   (a pilot of one cell: add -e ASSIGN_CELLS=reasoning_intent)
#
# Secrets (GEMINI_API_KEY, ADMIN_TOKEN) are never in the image: they come from the platform's secret
# store or `-e` at run time. Everything participants produce is under /app/logs (sessions/ and
# thinker/), which must be a persistent volume: a redeploy replaces the container, not the volume.

FROM node:22-bookworm-slim

# The build stamps the commit into every log header's appVersion; there is no .git in the image.
ARG APP_COMMIT=""
# Extra flags for build:prod. Leave empty (the full CI runs first); `--skip-ci` only for a commit
# whose `npm run ci` already passed elsewhere.
ARG BUILD_FLAGS=""

WORKDIR /app
# No NODE_ENV=production here: build:prod runs the tests first, which need the test environment.

# Dependencies first, so a code change does not reinstall them. Development dependencies are needed:
# the server runs TypeScript through tsx, and build:prod runs the typecheck and the tests.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Thinker's embedding model (multilingual-e5-small at the pinned revision) must be on disk: the server
# never downloads it (it embeds with exactly the files the index was built with). A `.cache/` copied
# from the machine that built the index is used as it is; otherwise it is fetched once here, at build
# time, from Hugging Face.
RUN if [ ! -d .cache/thinker-models/Xenova/multilingual-e5-small ]; then \
      node_modules/.bin/tsx -e "import('./server/thinker/e5-embedder.ts').then((m) => m.loadE5Embedder({ allowRemote: true })).then(() => console.log('model cached'))"; \
    fi

RUN APP_COMMIT="$APP_COMMIT" npm run build:prod -- $BUILD_FLAGS

# Listen on every interface inside the container; the platform's proxy terminates HTTPS in front.
# AUTO_ASSIGN=1: the shared study link `/?tuotanto` issues the next allocation code (docs/DEPLOYMENT.md
# §7.1). A pilot may restrict it with ASSIGN_CELLS at run time (`docker run -e`);
# never here, so the study image cannot inherit a pilot's filter.
ENV HOST=0.0.0.0 \
    PORT=8080 \
    THINKER_MODE=study \
    SESSION_LOG_DIR=/app/logs/sessions \
    AUTO_ASSIGN=1
EXPOSE 8080
VOLUME ["/app/logs"]

# A fresh platform volume is owned by root: make it the node user's, then run the server as node
# (no root process serves participants). tsx directly, not npm, so SIGTERM reaches the server.
CMD ["sh", "-c", "mkdir -p /app/logs/sessions /app/logs/thinker && chown -R node:node /app/logs && exec su node -s /bin/sh -c 'exec node_modules/.bin/tsx server/production/main.ts'"]
