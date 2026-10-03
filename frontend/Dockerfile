FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY backend/api/package*.json ./backend/api/
COPY backend/simulator/package*.json ./backend/simulator/
COPY backend/batch-attribution/package*.json ./backend/batch-attribution/
COPY backend/streaming/package*.json ./backend/streaming/
COPY frontend/package*.json ./frontend/

RUN npm install

COPY frontend ./frontend

RUN npm --workspace=frontend run build

FROM nginx:alpine

COPY --from=builder /usr/src/app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
