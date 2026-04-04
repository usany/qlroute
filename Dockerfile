# Use the official Deno image
FROM denoland/deno:latest

# Set the working directory
WORKDIR /
COPY . .

# Copy server code into the container
COPY deno.json .
COPY deno.lock .
RUN deno install

# Set permissions (optional but recommended for security)
# USER deno

# WORKDIR /app
# Expose port 5000
EXPOSE 5000

# Run the Deno server
CMD ["run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]