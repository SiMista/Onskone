cd ~/apps/Onskone

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
pnpm install

echo "Building shared..."
pnpm run build:shared

echo "Building frontend..."
cd frontend && pnpm run build && cd ..

echo "Restarting backend..."
pm2 restart onskone-backend

echo "Deployment complete!"
