# The OpenCASCADE kernel only ships as a Python wheel, so the image carries both runtimes.
# Node builds and serves; Python owns the geometry kernel that writes STEP.

# ---------- build the TypeScript server and the phone frontend ----------
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
RUN npx tsc

COPY web/package.json ./web/
WORKDIR /app/web
RUN npm install --no-audit --no-fund

WORKDIR /app
COPY web ./web
WORKDIR /app/web
RUN npx tsc -b && npx vite build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime

# libgl and friends are pulled in by vtk, which cadquery-ocp depends on.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    libgl1 \
    libglib2.0-0 \
    libxrender1 \
    libxext6 \
    libsm6 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY python ./python
RUN python3 -m venv .venv \
  && .venv/bin/pip install --no-cache-dir --upgrade pip \
  && .venv/bin/pip install --no-cache-dir -r python/requirements.txt \
  && .venv/bin/python -c "from build123d import Box, export_step; print('build123d ready')"

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    SCAN_OUTPUT_DIRECTORY=/app/output

RUN mkdir -p /app/output && chown -R node:node /app/output
USER node

EXPOSE 4000
VOLUME ["/app/output"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
