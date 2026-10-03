FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY backend/api/package*.json ./backend/api/
COPY backend/simulator/package*.json ./backend/simulator/
COPY backend/batch-attribution/package*.json ./backend/batch-attribution/
COPY backend/streaming/package*.json ./backend/streaming/
COPY frontend/package*.json ./frontend/

RUN npm install --omit=dev

COPY backend ./backend
COPY docs ./docs

EXPOSE 3000

CMD ["node", "backend/api/src/server.js"]
