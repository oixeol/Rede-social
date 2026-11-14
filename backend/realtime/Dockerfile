FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --omit=dev

EXPOSE 3002
CMD ["node", "dist/server.js"]