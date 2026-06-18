FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data
EXPOSE 3001
CMD ["sh", "-c", "node db/seed.js 2>/dev/null || true && node server.js"]
