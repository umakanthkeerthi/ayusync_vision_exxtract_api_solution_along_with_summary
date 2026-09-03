# AWS EC2 Free Tier (`t2.micro`) Deployment Guide

This guide walks you through deploying **Ayusync (Backend + Frontend + Nginx)** on a free AWS EC2 `t2.micro` or `t3.micro` instance (1 vCPU, 1 GB RAM).

---

## 1. Launch Your Free Tier EC2 Instance

In the [AWS EC2 Console](https://console.aws.amazon.com/ec2/):

1. Click **Launch Instances**.
2. **Name**: `ayusync-ocr-server`
3. **Application and OS Images (AMI)**: Select **Ubuntu Server 24.04 LTS** (marked *"Free tier eligible"*).
4. **Instance Type**: Select **`t2.micro`** (or `t3.micro` if in supported regions).
5. **Key pair**: Create a new key pair or select an existing one (download the `.pem` file).
6. **Network Settings (Security Group)**:
   * ✅ Check **Allow SSH traffic from Anywhere (or My IP)** (Port 22)
   * ✅ Check **Allow HTTP traffic from the internet** (Port 80)
   * ✅ Check **Allow HTTPS traffic from the internet** (Port 443)
7. **Storage**: Default 8 GB or 10 GB gp3 (Free tier covers up to 30 GB EBS).
8. Click **Launch Instance**.

---

## 2. Connect to Your Instance via SSH

Open your terminal (PowerShell, Command Prompt, or Git Bash) on your computer where your `.pem` key was downloaded:

```bash
# Set proper permission on key (if Linux/Mac/Git Bash):
chmod 400 your-key.pem

# SSH into the server:
ssh -i "your-key.pem" ubuntu@<YOUR-EC2-PUBLIC-IP>
```

---

## 3. One-Command Automated Deployment

Once connected to your Ubuntu EC2 terminal, run:

```bash
# 1. Clone the repository
git clone https://github.com/umakanthkeerthi/ayusync_vision_exxtract_api_solution_along_with_summary.git

# 2. Enter the repository directory
cd ayusync_vision_exxtract_api_solution_along_with_summary

# 3. Make setup script executable and run it
chmod +x setup_ec2.sh
./setup_ec2.sh
```

### What `setup_ec2.sh` automatically configures:
1. **2GB Swap File**: Prevents out-of-memory errors on the 1GB RAM Free Tier instance during builds.
2. **System Dependencies**: Installs Python 3, venv, pip, Node.js 20 LTS, Nginx, and build tools.
3. **Backend Service (`systemd`)**: Creates and starts a managed `ayusync-backend` systemd service with automatic reboot recovery.
4. **Frontend Production Build**: Compiles optimized static assets with Vite.
5. **Nginx Reverse Proxy**:
   * Serves the React UI on standard HTTP Port 80.
   * Proxies all API calls (`/api/*`) to the backend.
   * Extends timeouts to 120s for AI vision inference.

---

## 4. Set Your Groq API Key

After the script completes, add your Groq API key:

```bash
nano backend/.env
```

Set your key:
```env
GROQ_API_KEY=gsk_your_actual_key_here
```
Save and exit (`Ctrl + O`, `Enter`, then `Ctrl + X`).

Restart the backend service to apply the key:
```bash
sudo systemctl restart ayusync-backend
```

---

## 5. Verify Your Deployment

Open your browser or make an HTTP request:

* **Web UI**: `http://<YOUR-EC2-PUBLIC-IP>`
* **Interactive API Docs**: `http://<YOUR-EC2-PUBLIC-IP>/docs`
* **API Endpoint for Main Solution**: `http://<YOUR-EC2-PUBLIC-IP>/api/analyze`

### Test from your Main Solution (cURL):

```bash
curl -X POST "http://<YOUR-EC2-PUBLIC-IP>/api/analyze" \
     -F "file=@sample_prescription.jpg"
```

---

## 6. Helpful Maintenance Commands on EC2

* **Check backend service status**:
  ```bash
  sudo systemctl status ayusync-backend
  ```
* **View backend logs in real-time**:
  ```bash
  sudo journalctl -u ayusync-backend -f
  ```
* **Check Nginx status & logs**:
  ```bash
  sudo systemctl status nginx
  sudo tail -f /var/log/nginx/error.log
  ```
* **Pull latest code updates**:
  ```bash
  git pull origin main
  sudo systemctl restart ayusync-backend
  cd frontend && npm run build
  ```
