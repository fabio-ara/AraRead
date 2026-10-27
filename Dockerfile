FROM node:24.14.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY scripts/build-widget.ts ./scripts/build-widget.ts
COPY public ./public
COPY LICENSE THIRD_PARTY_NOTICES.md THIRD_PARTY_LICENSES.txt ./
RUN npm run build

FROM node:24.14.0-bookworm-slim
ENV NODE_ENV=production APP_MODE=production PORT=4317
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node certs ./certs
COPY --chown=node:node LICENSE THIRD_PARTY_NOTICES.md THIRD_PARTY_LICENSES.txt ./
USER node
EXPOSE 4317
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4317)+'/health',{headers:{Host:new URL(process.env.APP_ORIGIN).host}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--import","tsx","src/server.ts"]
