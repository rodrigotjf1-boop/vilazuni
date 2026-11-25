FROM node:24.22.1-bookworm-slim AS build
WORKDIR /opt/vilazuni
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci --ignore-scripts
COPY apps/api/ apps/api/
COPY apps/web/ apps/web/
COPY packages/domain/ packages/domain/
RUN npm run build \
    && find apps/web/dist -name '*.map' -delete \
    && npm prune --omit=dev --ignore-scripts

FROM node:24.22.1-bookworm-slim AS runtime
WORKDIR /opt/vilazuni
ENV NODE_ENV=production PORT=3100 VILAZUNI_WEB_DIR=/opt/vilazuni/apps/web/dist
COPY --from=build /opt/vilazuni/node_modules ./node_modules
COPY --from=build /opt/vilazuni/package.json ./package.json
COPY --from=build /opt/vilazuni/apps/api/package.json ./apps/api/package.json
COPY --from=build /opt/vilazuni/apps/api/dist ./apps/api/dist
COPY --from=build /opt/vilazuni/apps/api/migrations ./apps/api/migrations
COPY --from=build /opt/vilazuni/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /opt/vilazuni/packages/domain/dist ./packages/domain/dist
COPY --from=build /opt/vilazuni/apps/web/dist ./apps/web/dist
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3100/api/v1/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
