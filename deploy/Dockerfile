FROM node:24.19.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /opt/vilazuni
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --cache /tmp/npm-cache && rm -rf /tmp/npm-cache
COPY --chown=node:node app/ ./
RUN mkdir -p /var/lib/vilazuni && chown node:node /var/lib/vilazuni
USER node
ENV HOST=0.0.0.0 PORT=4173 VILAZUNI_DATA_DIR=/var/lib/vilazuni
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
