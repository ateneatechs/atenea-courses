FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && chmod +x node_modules/.bin/*
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads/images uploads/videos
EXPOSE 3000
CMD ["node", "dist/server.js"]
