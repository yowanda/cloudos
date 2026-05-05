FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/desktop/ apps/desktop/

RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@cloudos/desktop

FROM nginx:alpine

COPY --from=builder /app/apps/desktop/dist /usr/share/nginx/html

COPY apps/desktop/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
