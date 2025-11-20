# Build stage
FROM node:20-alpine AS builder

ARG VITE_API_URL=http://backend:8000
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Carry over API endpoint for reference/diagnostics
ARG VITE_API_URL=http://backend:8000
ENV VITE_API_URL=${VITE_API_URL}

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
