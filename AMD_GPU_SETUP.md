# AMD GPU Setup Guide for Ollama

If your Ollama server is running but only using CPU despite having an AMD GPU (like RX580), follow this guide.

## Problem Diagnosis

Check your Ollama logs for these indicators:
- `inference compute id=cpu library=cpu` — only CPU is detected
- `HIP_VISIBLE_DEVICES=0` — AMD ROCm is trying but not finding GPUs
- `total_vram="0 B"` — GPU VRAM not detected

## Prerequisites

Before running Ollama with AMD GPU support, install the AMD ROCm drivers:

### Step 1: Install AMD ROCm

**Option A: Ubuntu 24.04 (Recommended - Using APT with correct repo)**

```bash
# Add AMD repo (use 'noble' for Ubuntu 24.04, 'jammy' for 22.04)
sudo wget -qO - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo "deb [arch=amd64] https://repo.radeon.com/rocm/apt/ubuntu noble main" | sudo tee /etc/apt/sources.list.d/rocm.sources.list

# Update and install
sudo apt update
sudo apt install -y rocm-hip-sdk rocm-libs

# Add your user to the video and render groups
sudo usermod -a -G video $USER
sudo usermod -a -G render $USER
```

**Option B: Ubuntu 22.04 (Jammy)**

```bash
# Add AMD repo for jammy
sudo wget -qO - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo "deb [arch=amd64] https://repo.radeon.com/rocm/apt/debian jammy main" | sudo tee /etc/apt/sources.list.d/rocm.sources.list

# Update and install
sudo apt update
sudo apt install -y rocm-hip-sdk rocm-libs

# Add your user to the video and render groups
sudo usermod -a -G video $USER
sudo usermod -a -G render $USER
```

**Option C: If APT has dependency conflicts (Alternative method)**

If you get "unmet dependencies" errors like `rocminfo` or `hipcc` version mismatches, use the standalone installer:

```bash
# Download ROCm standalone installer
mkdir -p ~/rocm-install
cd ~/rocm-install
wget https://repo.radeon.com/rocm/apt/ubuntu/pool/main/r/rocm-core/rocm-core_6.0.0.60003-1~24.04_amd64.deb
wget https://repo.radeon.com/rocm/apt/ubuntu/pool/main/h/hip-runtime-amd/hip-runtime-amd_5.7.1.50701-1~24.04_amd64.deb

# Install manually
sudo apt install -y ./rocm-core_*.deb ./hip-runtime-amd_*.deb

# Or use the pre-built Ollama which includes ROCm support
# (see "Option D" below)
```

**Option D: Docker with Official Ollama Image (Ubuntu 24.04 Recommended)** ⭐

Ubuntu 24.04 doesn't have stable ROCm packages in its repositories. **Docker is the cleanest solution:**

```bash
# 1. Install Docker (if not already installed)
sudo apt install -y docker.io
sudo usermod -a -G docker $USER
# Log out and back in

# 2. Stop current Ollama
killall ollama 2>/dev/null || true

# 3. Run official Ollama with AMD GPU support
docker run -d \
  --name ollama \
  --restart unless-stopped \
  -p 11434:11434 \
  --device /dev/kfd \
  --device /dev/dri \
  -v ollama:/root/.ollama \
  ollama/ollama:latest

# 4. Wait for it to start, then pull a model
sleep 3
docker exec ollama ollama pull llama3.2

# 5. Check GPU detection in logs
docker logs ollama | tail -20 | grep -i "total_vram\|rocm\|hip"
```

**Verify it's working:**
```bash
# Test the model
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "What is 2+2?",
  "stream": false
}'

# Or check GPU usage while running
watch -n 1 "docker logs ollama | tail -3"
```

**Advantages:**
- ✅ No Ubuntu 24.04 package conflicts
- ✅ Pre-configured with ROCm support
- ✅ Easy to update (just pull new image)
- ✅ Isolated from system dependencies
- ✅ Your WhatsApp bot connects to `http://localhost:11434`

**On CentOS/RHEL:**
```bash
sudo yum install -y rocm-hip-sdk rocm-libs
```

**Verify installation:**
```bash
rocm-smi  # Should show your GPU info
```

### Step 2: Rebuild/Reinstall Ollama

After installing ROCm, rebuild Ollama with GPU support:
```bash
# Stop Ollama if running
killall ollama 2>/dev/null || true

# Reinstall/rebuild Ollama (this should auto-detect ROCm now)
# If using pre-built: download the latest from https://ollama.com/download
# If building from source: make sure ROCm is installed first

# Restart Ollama
ollama serve &
```

## Troubleshooting

### Issue: APT dependency conflicts with rocm-hip-sdk on Ubuntu 24.04

Ubuntu 24.04 (noble) has known version conflicts in the ROCm repository. If you get errors like:
```
rocm-hip-runtime : Depends: rocminfo (= 1.0.0.70203) but 5.7.1 is to be installed
rocm-hip-runtime-dev : Depends: hipcc (= 1.1.1.70203) but 5.7.1 is to be installed
```

**Best Solution: Use Ollama's bundled ROCm (no apt conflicts)** ⭐

Ollama 0.21+ comes with ROCm support pre-compiled. Just install/update Ollama and it will auto-detect your GPU:

```bash
# Option 1: Use official installer
curl -fsSL https://ollama.ai/install.sh | sh

# Option 2: Or if using docker
docker run -d --device /dev/kfd --device /dev/dri --name ollama \
  -p 11434:11434 ollama/ollama:latest

# Restart Ollama
sudo systemctl restart ollama
# or manually:
killall ollama 2>/dev/null || true
sleep 1
ollama serve &

# Verify GPU detected (wait 3-5 seconds for Ollama to initialize)
sleep 5
tail -50 ~/.ollama/logs/ollama.log | grep -i "total_vram\|rocm\|hip"
```

**Alternative: Skip APT, use just runtime libraries:**

If you must install ROCm system-wide, avoid rocm-hip-sdk and use only the runtime:

```bash
# Clean previous broken installs
sudo apt remove -y rocm-hip-sdk rocm-hip-runtime rocm-hip-runtime-dev 2>/dev/null || true
sudo apt autoremove -y

# Just install minimal runtime
sudo apt install -y rocm-core rocm-libs libhip-runtime64-amd64

# Add user to groups
sudo usermod -a -G video $USER
sudo usermod -a -G render $USER

# Log out and back in, then restart Ollama
```

**If still broken: Clear the ROCm repo and just use Ollama alone:**

```bash
# Remove the problematic ROCm repo
sudo rm /etc/apt/sources.list.d/rocm.sources.list
sudo apt update

# Ollama doesn't strictly require rocm-hip-sdk to be installed
# If Ollama was built with ROCm, it has its own bundled libraries
# Just restart Ollama:
killall ollama 2>/dev/null || true
ollama serve &
```

### Issue: "user overrode visible devices" warning
This means `HIP_VISIBLE_DEVICES` is set incorrectly.

**Solution:** Clear it and let Ollama auto-detect:
```bash
unset HIP_VISIBLE_DEVICES
unset ROCR_VISIBLE_DEVICES
ollama serve &
```

### Issue: GPUs still not detected after installing ROCm

1. **Verify ROCm sees your GPU:**
   ```bash
   rocm-smi
   ```
   If this shows no GPU, the drivers aren't properly installed or the GPU isn't detected by the system.

2. **Check group permissions:**
   ```bash
   groups $USER  # Should include 'video' and 'render'
   ```
   If missing, re-run:
   ```bash
   sudo usermod -a -G video $USER
   sudo usermod -a -G render $USER
   # Log out and back in
   ```

3. **Verify Ollama is built with HIP support:**
   ```bash
   ldd /usr/local/bin/ollama | grep -i hip
   # Should show libhip references if HIP support is compiled in
   ```

### Issue: Model performance is slow (still on CPU?)

Even if GPU is detected, you may need to:

1. **Use a smaller quantized model:**
   ```bash
   ollama pull llama3.2:1b        # tiny
   ollama pull llama3.2-vision:11b-q4_k_m  # medium, 4-bit quantized
   ```

2. **Check Ollama logs during inference:**
   ```
   tail -f ~/.ollama/logs/ollama.log
   ```
   Look for "loading" and compute type messages.

3. **Force GPU usage with environment variables:**
   ```bash
   # Optional: explicitly set GPU device (usually 0)
   export HIP_VISIBLE_DEVICES=0
   ollama serve &
   ```

## Verify GPU is Being Used

After Ollama starts, pull a model and test:
```bash
ollama pull llama3.2-vision:11b-q4_k_m
ollama run llama3.2-vision:11b-q4_k_m "What's 2+2?"
```

Check your Ollama logs:
```bash
tail -50 ~/.ollama/logs/ollama.log | grep -E "(total_vram|inference compute|compute="
```

Look for:
- `total_vram="<non-zero>"` — GPU VRAM detected ✓
- `compute="rocm"` or `library="rocm"` — GPU compute enabled ✓

## Hardware Compatibility

AMD GPU support in Ollama requires RDNA or RDNA2 architectures (Radeon RX 5000+ series):
- **RX 5500** ✓ supported
- **RX 5700** ✓ supported
- **RX 6600** ✓ supported
- **RX 6700** ✓ supported
- **RX 6800** ✓ supported

Older Polaris (RX 470/480) may work but with limited driver support.

## Getting Help

If problems persist:
1. Check Ollama GitHub issues: https://github.com/ollama/ollama/issues
2. Check ROCm documentation: https://rocmdocs.amd.com/
3. Share `rocm-smi` output and Ollama logs when asking for help

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `HIP_VISIBLE_DEVICES` | Which GPU(s) to use (0=first) | `HIP_VISIBLE_DEVICES=0` |
| `ROCR_VISIBLE_DEVICES` | Alternative GPU selection | `ROCR_VISIBLE_DEVICES=0` |
| `OLLAMA_DEBUG` | Enable debug logging | `OLLAMA_DEBUG=1` |
| `OLLAMA_HOST` | Ollama server address | `OLLAMA_HOST=http://127.0.0.1:11434` |

## Recommended Settings for RX580

### If Using Docker (Ubuntu 24.04+):

Your `.env` file can stay as-is:
```env
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

The Docker container automatically handles GPU access and ROCm.

### If Using Native Binary (Ubuntu 22.04 with ROCm):

```bash
# Add to ~/.bashrc or ~/.zshrc
export HIP_VISIBLE_DEVICES=0
export OLLAMA_HOST=http://127.0.0.1:11434

# Start Ollama
ollama serve &
```

Then in your `.env` file for this bot:
```env
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2-vision:11b-q4_k_m
# or smaller for older hardware:
# OLLAMA_MODEL=llama3.2:1b
```

## Switching from Binary to Docker

If you already have Ollama running as a binary/service:

```bash
# 1. Stop the running Ollama service
sudo systemctl stop ollama 2>/dev/null || true
killall ollama 2>/dev/null || true

# 2. Back up your models (optional, Docker will re-download if needed)
# cp -r ~/.ollama ~/ollama-backup

# 3. Start Docker version (see Option D above)
docker run -d \
  --name ollama \
  --restart unless-stopped \
  -p 11434:11434 \
  --device /dev/kfd \
  --device /dev/dri \
  -v ollama:/root/.ollama \
  ollama/ollama:latest

# 4. Your WhatsApp bot will connect to the same http://localhost:11434
# No config changes needed!
```
