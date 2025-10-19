# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Run the build command
RUN tsc -b && vite build

# Stage 2: Serve the application with a lightweight server
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the built files from the previous stage
COPY --from=builder /app/dist ./dist

# Install the 'serve' package globally to make it available
RUN npm install -g serve

# Expose the port on which the app will run (e.g., 3000)
EXPOSE 3000

# Set the entrypoint to run the serve command
# The 'serve -s' is for Single Page Applications (SPA)
CMD ["serve", "-s", "dist"]