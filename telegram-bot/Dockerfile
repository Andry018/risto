FROM node:20-alpine

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .
RUN npm run build

# Non-root user
RUN addgroup -S app && adduser -S -G app app
USER app

CMD ["node", "dist/index.js"]