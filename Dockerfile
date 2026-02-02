# ImmoBot Dockerfile
# Multi-stage build für optimierte Image-Größe

FROM node:18-slim AS builder

WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm ci

# TypeScript kompilieren
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Produktions-Image
FROM node:18-slim

# Chrome/Chromium Abhängigkeiten
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer Konfiguration
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Arbeitsverzeichnis
WORKDIR /app

# Node Benutzer erstellen
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && mkdir -p /app/data /app/logs \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Produktions-Abhängigkeiten
COPY package*.json ./
RUN npm ci --only=production

# Kompilierte Dateien kopieren
COPY --from=builder /app/dist ./dist
COPY templates ./templates

# Benutzer wechseln
USER pptruser

# Healthcheck
HEALTHCHECK --interval=5m --timeout=30s --start-period=10s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Bot starten
CMD ["node", "dist/index.js"]
