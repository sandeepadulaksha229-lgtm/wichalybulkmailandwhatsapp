# Use official Node.js 20 LTS slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy all source files
COPY . .

# Create WhatsApp session directory
RUN mkdir -p .whatsapp_session

# Expose port (Koyeb uses PORT env variable)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/status', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start server
CMD ["node", "server.js"]
