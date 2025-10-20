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

# Inject a small placeholder into the built index.html so we can replace it at runtime
# This creates a predictable string __API_URL__ we replace from the entrypoint.
RUN if [ -f dist/index.html ]; then \
			awk 'BEGIN{printed=0} /<\/head>/{ if (!printed) { print "<script>window.__API_URL__=\"__API_URL__\"<\\/script>"; printed=1 } } {print}' dist/index.html > dist/index.html.tmp && mv dist/index.html.tmp dist/index.html ; \
		fi

# Stage 2: Serve the application with a lightweight server
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the built files from the previous stage
# `vite build` typically outputs to the `dist` folder.
# Copy built files
COPY --from=builder /app/dist ./dist

# Copy entrypoint for runtime URL injection
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Install the 'serve' package globally
RUN npm install -g serve

# Expose a default port (optional). The platform will set $PORT at runtime.
EXPOSE 3000

# Use the shell form so the runtime $PORT env var is respected. If PORT is not
# provided by the environment, default to 3000. This avoids connection refused
# issues on platforms that expect the container to bind the provided $PORT.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh","-c","serve -s dist -l ${PORT:-3000}"]