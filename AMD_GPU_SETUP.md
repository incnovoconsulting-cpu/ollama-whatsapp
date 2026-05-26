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

**Option D: Use Pre-built Ollama with ROCm (Easiest)**

The easiest solution is to use the latest Ollama release, which comes with ROCm support pre-bundled:

```bash
# Download latest Ollama (includes ROCm)
curl -fsSL https://ollama.ai/install.sh | sh

# Or if you already have ollama installed, just restart it
killall ollama 2>/dev/null || true
ollama serve &
```

Then verify GPU detection:
```bash
rocm-smi
```

If `rocm-smi` is not found, try just starting Ollama anyway — if it has ROCm support, it will detect the GPU automatically.

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

### Issue: APT dependency conflicts with rocm-hip-sdk

If you get errors like:
```
rocm-hip-runtime : Depends: rocminfo (= 1.0.0.70203) but 5.7.1 is to be installed
```

**Solution:** Use one of these alternatives:

1. **Clean up held packages:**
   ```bash
   sudo apt-mark unhold rocm-hip-runtime rocm-hip-runtime-dev rocminfo hipcc rocm-cmake
   sudo apt update
   sudo apt install -y rocm-hip-sdk rocm-libs
   ```

2. **Or use Ollama's pre-bundled ROCm** (recommended):
   ```bash
   # Get latest Ollama which includes ROCm support
   curl -fsSL https://ollama.ai/install.sh | sh
   killall ollama 2>/dev/null || true
   ollama serve &
   ```

3. **Or manually fix by removing conflicting versions:**
   ```bash
   sudo apt remove rocminfo hipcc rocm-cmake --allow-remove-essential
   sudo apt update
   sudo apt install -y rocm-hip-sdk rocm-libs
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
