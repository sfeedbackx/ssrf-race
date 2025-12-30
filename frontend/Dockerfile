# Build stage
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config template (nginx will auto-substitute env vars from /etc/nginx/templates/)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Set default values for environment variables
ENV BACKEND_HOST=ctf_ssrf
ENV BACKEND_PORT=5000

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
