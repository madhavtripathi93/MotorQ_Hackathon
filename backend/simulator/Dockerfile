FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY backend/api/package*.json ./backend/api/
COPY backend/simulator/package*.json ./backend/simulator/
COPY backend/batch-attribution/package*.json ./backend/batch-attribution/
COPY backend/streaming/package*.json ./backend/streaming/
COPY frontend/package*.json ./frontend/

RUN npm install --omit=dev

COPY backend/api ./backend/api
COPY backend/simulator ./backend/simulator

CMD ["node", "backend/simulator/src/cli.js", "--vehicles", "100000"]
