# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies, including devDependencies
# The default `npm install` includes both dependencies and devDependencies
# unless NODE_ENV is set to `production`, which it isn't in this stage.
RUN npm install

# Copy the rest of the application code
COPY . .

# Run the build command via npm so node_modules/.bin is available
RUN npm run build

# Stage 2: Serve the application with a lightweight server
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the built files from the previous stage
# `vite build` typically outputs to the `dist` folder.
COPY --from=builder /app/dist ./dist

# Install the 'serve' package globally
RUN npm install -g serve

# Expose a default port (optional). The platform will set $PORT at runtime.
EXPOSE 3000

# Use the shell form so the runtime $PORT env var is respected. If PORT is not
# provided by the environment, default to 3000. This avoids connection refused
# issues on platforms that expect the container to bind the provided $PORT.
CMD sh -c "serve -s dist -l ${PORT:-3000}"