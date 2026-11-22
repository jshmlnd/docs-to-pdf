# Build the React app.
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# The converter: LibreOffice + server.js, which also serves the built app.
FROM node:22-bookworm-slim
# LibreOffice Writer + common fonts (Carlito/Caladea are metric-compatible with Calibri/Cambria,
# Liberation with Arial/Times/Courier), so pages break where Word breaks them.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui fonts-crosextra-carlito fonts-crosextra-caladea \
      fonts-liberation2 fonts-dejavu-core fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.js word-compat.js ./
COPY --from=web /web/dist ./public
USER node
# Heroku sets PORT at runtime; 3000 is the local default.
ENV PORT=3000
# 2 parallel LibreOffice jobs peak at ~365 MB, inside a 512 MB Heroku dyno.
# (Dynos report the host's CPU count, so the per-CPU default would start far too many.)
ENV MAX_JOBS=2
EXPOSE 3000
CMD ["node", "server.js"]
