#!/usr/bin/env bash
# ==============================================================================
# Ayusync AWS EC2 Free Tier (t2.micro / t3.micro) One-Click Deployment Script
# Tested on: Ubuntu 22.04 / 24.04 LTS
# ==============================================================================

set -e

echo "=== [1/7] Setting up 2GB Swap Space (Critical for 1GB Free Tier RAM) ==="
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap created and activated successfully."
else
    echo "Swap file already exists."
fi

echo "=== [2/7] Updating System Packages & Installing Dependencies ==="
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv nginx curl git build-essential

# Install Node.js LTS (v20 or v22)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

PROJECT_DIR="$(pwd)"
echo "Current directory: $PROJECT_DIR"

echo "=== [3/7] Setting up Python Virtual Environment for Backend ==="
cd "$PROJECT_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Ensure .env exists with GROQ_API_KEY
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Created backend/.env from .env.example. PLEASE UPDATE YOUR GROQ_API_KEY!"
    else
        touch .env
    fi
fi

echo "=== [4/7] Creating Systemd Service for Backend ==="
USER_NAME="$(whoami)"
SERVICE_FILE="/etc/systemd/system/ayusync-backend.service"

sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Ayusync FastAPI Backend Service
After=network.target

[Service]
User=$USER_NAME
WorkingDirectory=$PROJECT_DIR/backend
EnvironmentFile=$PROJECT_DIR/backend/.env
ExecStart=$PROJECT_DIR/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOL

sudo systemctl daemon-reload
sudo systemctl enable ayusync-backend
sudo systemctl restart ayusync-backend

echo "=== [5/7] Building Frontend Static Assets ==="
cd "$PROJECT_DIR/frontend"
npm install
npm run build

echo "=== [6/7] Configuring Nginx Reverse Proxy ==="
NGINX_CONF="/etc/nginx/sites-available/ayusync"

sudo bash -c "cat > $NGINX_CONF" <<EOL
server {
    listen 80;
    server_name _;

    client_max_body_size 25M;

    # Frontend Static Files
    location / {
        root $PROJECT_DIR/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Extended timeouts for Vision LLM inference
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
    }

    # API Documentation (Swagger / OpenAPI)
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host \$host;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host \$host;
    }
}
EOL

# Enable site in Nginx
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl restart nginx

echo "=== [7/7] Deployment Complete! ==="
PUBLIC_IP="$(curl -s http://checkip.amazonaws.com || echo 'your-ec2-ip')"
echo ""
echo "🚀 Ayusync is now running on your EC2 instance!"
echo "👉 Web App:  http://$PUBLIC_IP"
echo "👉 API Docs: http://$PUBLIC_IP/docs"
echo "👉 API Endpoint for your main solution: http://$PUBLIC_IP/api/analyze"
echo ""
echo "⚠️  Important: Remember to add your GROQ_API_KEY into: $PROJECT_DIR/backend/.env"
echo "    Then restart backend: sudo systemctl restart ayusync-backend"
