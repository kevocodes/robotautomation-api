FROM node:22 AS build
WORKDIR /usr/src/app
COPY package.json .
COPY yarn.lock .
COPY . .

RUN yarn
RUN npx prisma generate
RUN npm run build

FROM node:22-slim
RUN apt update && apt install libssl-dev dumb-init -y --no-install-recommends
WORKDIR /usr/src/app
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/.env .env
COPY --chown=node:node --from=build /usr/src/app/package.json .
COPY --chown=node:node --from=build /usr/src/app/yarn.lock .
RUN yarn install --production
COPY --chown=node:node --from=build /usr/src/app/node_modules/.prisma/client  ./node_modules/.prisma/client

ENV NODE_ENV production
EXPOSE 3000
CMD ["dumb-init", "node", "dist/main"]