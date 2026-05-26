#!/bin/bash
set -e

echo "=== Ollama-WhatsApp Bot Setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Check for AMD GPU support
echo ""
echo "Checking GPU support..."
if command -v rocm-smi &> /dev/null; then
  echo "✓ AMD ROCm detected"
  rocm-smi --showproductname 2>/dev/null || rocm-smi | head -5
  echo "  See AMD_GPU_SETUP.md for configuration help"
else
  if command -v nvidia-smi &> /dev/null; then
    echo "✓ NVIDIA CUDA detected"
  else
    echo "⚠ No GPU acceleration detected"
    echo "  For AMD GPU: Install ROCm (see AMD_GPU_SETUP.md)"
    echo "  For NVIDIA GPU: Install CUDA"
  fi
fi

# Install dependencies
echo "Installing dependencies..."
npm install --no-audit --no-fund --loglevel=error

# Setup .env if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env from template..."
  cp .env.example .env
  # Set model to llama3:70b for your hardware
  sed -i 's/OLLAMA_MODEL=.*/OLLAMA_MODEL=llama3:70b-instruct-q4_k_m/' .env
  echo "✓ .env created (edit as needed)"
fi

# Check Ollama
if ! command -v ollama &> /dev/null; then
  echo "Ollama not found. Install from: https://ollama.com/download"
  exit 1
fi

OLLAMA_VERSION=$(ollama --version)
echo "✓ Ollama $OLLAMA_VERSION"

# Check if Ollama service is running
if ! pgrep -x "ollama" > /dev/null; then
  echo "⚠ Ollama is not running. Start it first:"
  echo "  ollama serve &"
  exit 1
fi
echo "✓ Ollama service is running"

# Pull model
MODEL=$(grep OLLAMA_MODEL .env | cut -d= -f2)
echo "Checking model: $MODEL..."
if ! ollama list | grep -q "$MODEL"; then
  echo "Pulling $MODEL (this may take a while)..."
  ollama pull "$MODEL"
fi
echo "✓ Model ready"

# Create systemd service (optional)
if command -v systemctl &> /dev/null && [ "$1" == "--systemd" ]; then
  echo "Creating systemd service..."
  sudo tee /etc/systemd/system/ollama-whatsapp.service > /dev/null <<EOF
[Unit]
Description=Ollama WhatsApp Bot
After=network.target ollama.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) ollama.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable ollama-whatsapp
  echo "✓ Service created. Start with: sudo systemctl start ollama-whatsapp"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Make sure Ollama is running: ollama serve"
echo "  2. Start the bot: npm start"
echo "  3. Scan QR code with WhatsApp on your phone"
echo ""
echo "Commands in chat: /help"
