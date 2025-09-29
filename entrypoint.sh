#!/bin/sh
# entrypoint.sh

# Exit immediately if a command exits with a non-zero status.
set -e

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy
echo "Prisma migrations completed."

# Start the application
echo "Starting the application..."
exec node dist/server.js
