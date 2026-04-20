# ───────── Stage 1: build ─────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps separately for better layer caching
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
ENV NODE_ENV=production
RUN npm run build

# ───────── Stage 2: nginx ─────────
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
