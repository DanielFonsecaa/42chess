## Frontend Dockerfile - build with Node and serve static files with nginx
FROM node:20-alpine AS build
WORKDIR /app

# Accept a build arg to set the API base URL for Vite at build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# install dependencies
COPY package*.json ./
RUN npm ci

# copy source and build
COPY . .
# Ensure Vite picks up VITE_API_URL from ENV during build
RUN npm run build

FROM nginx:stable-alpine
# Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
# Copy custom nginx config to support client-side routing (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
