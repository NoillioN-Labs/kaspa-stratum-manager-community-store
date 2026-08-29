# syntax=docker/dockerfile:1.7

# Official Rusty Kaspa v2.0.1 Stratum Bridge source pin.
ARG RUSTY_KASPA_VERSION=v2.0.1
ARG RUSTY_KASPA_COMMIT=cfafeb4c093fa37a303f1b9f19c58f986b870ce3

FROM rust:1.91.0-bookworm AS bridge-build
ARG RUSTY_KASPA_VERSION
ARG RUSTY_KASPA_COMMIT
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential ca-certificates clang cmake git libclang-dev libssl-dev \
      pkg-config protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git init rusty-kaspa \
    && cd rusty-kaspa \
    && git remote add origin https://github.com/kaspanet/rusty-kaspa.git \
    && git fetch --depth 1 origin "refs/tags/${RUSTY_KASPA_VERSION}:refs/tags/${RUSTY_KASPA_VERSION}" \
    && test "$(git rev-list -n 1 "refs/tags/${RUSTY_KASPA_VERSION}")" = "${RUSTY_KASPA_COMMIT}" \
    && git checkout --detach "${RUSTY_KASPA_COMMIT}"
WORKDIR /src/rusty-kaspa
RUN cargo build --locked --release -p kaspa-stratum-bridge --bin stratum-bridge

FROM node:24.19.0-bookworm-slim AS app-build
RUN apt-get update \
    && apt-get install -y --no-install-recommends bash coreutils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN node -e "const lock = require('./package-lock.json'); if (lock.lockfileVersion !== 3) throw new Error('package-lock.json must use lockfileVersion 3')"
RUN npm ci
COPY . .
RUN find scripts docker -type f -name '*.sh' -exec sed -i 's/\r$//' {} +
RUN npm run build

FROM node:24.19.0-bookworm-slim AS runtime
ARG RUSTY_KASPA_VERSION
ARG RUSTY_KASPA_COMMIT
LABEL org.opencontainers.image.source="https://github.com/NoillioN-Labs/kaspa-stratum-manager" \
      org.opencontainers.image.title="Kaspa Stratum Manager" \
      org.opencontainers.image.version="0.3.0" \
      io.kaspa.stratum-bridge.version="${RUSTY_KASPA_VERSION}" \
      io.kaspa.stratum-bridge.commit="${RUSTY_KASPA_COMMIT}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/kaspa-stratum-manager
COPY --from=app-build --chown=node:node /app ./
COPY --from=bridge-build /src/rusty-kaspa/target/release/stratum-bridge /usr/local/bin/stratum-bridge
COPY --chown=node:node config/bridge.yaml /opt/kaspa-stratum-manager/config/bridge.yaml
COPY --from=app-build /app/docker/entrypoint.sh /usr/local/bin/kaspa-manager-entrypoint
RUN chmod 0755 /usr/local/bin/stratum-bridge /usr/local/bin/kaspa-manager-entrypoint \
    && mkdir -p /data \
    && chown -R node:node /data
USER node
ENV NODE_ENV=production PORT=8080
EXPOSE 8080 8081 3030 5555 2114
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/kaspa-manager-entrypoint"]
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "8080"]
