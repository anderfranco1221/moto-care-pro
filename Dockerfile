FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall runs `prisma generate` for both projects, so the schema must
# already be present by the time `npm ci` triggers it.
COPY prisma.config.ts prisma.tenant.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npx prisma generate --config prisma.tenant.config.ts
RUN npm run build
RUN npm prune --omit=dev
# @prisma-tenant/client isn't a declared package.json dependency (it's a
# generation target under node_modules), so `npm prune` treats it as
# extraneous and deletes it — regenerate it once more after pruning.
RUN npx prisma generate --config prisma.tenant.config.ts

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/prisma.tenant.config.ts ./prisma.tenant.config.ts
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main"]
