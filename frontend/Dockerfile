FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && chmod +x node_modules/.bin/*
COPY . .
# Bake the fixed tenant slug into the build for single-client / dedicated-domain deploys.
ARG VITE_DEFAULT_TENANT=naza-barber
RUN echo "VITE_DEFAULT_TENANT=$VITE_DEFAULT_TENANT" > .env.production
RUN echo "--- diag ---" \
    && ls -la node_modules/.bin/tsc \
    && ls -la node_modules/typescript/bin/tsc \
    && stat node_modules/typescript/bin/tsc \
    && head -c 100 node_modules/typescript/bin/tsc \
    && mount | grep -E ' / | /app ' \
    && echo "--- end diag ---"
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
