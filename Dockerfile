# تشغيل الداشبورد في حاوية Docker (Railway / Fly.io / أي VPS)
FROM node:22-alpine
WORKDIR /app
COPY extension ./extension
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
WORKDIR /app/server
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
