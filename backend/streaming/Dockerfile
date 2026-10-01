FROM node:24-alpine

WORKDIR /app

# Copy root package and workspace packages
COPY package*.json ./
COPY backend/api/package*.json ./backend/api/
COPY backend/streaming/package*.json ./backend/streaming/

# Install production dependencies
RUN npm install --omit=dev

# Copy application sources
COPY backend/api ./backend/api
COPY backend/streaming ./backend/streaming

ENV NODE_ENV=production

CMD ["node", "backend/streaming/src/index.js"]
