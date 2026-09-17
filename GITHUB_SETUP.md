# GitHub Setup

This project is ready to be pushed to GitHub. Here's how to set it up:

## Option 1: Create new repository from this code

```bash
cd /opt/data/cad-pipeline

# Initialize git
git init
git add .
git commit -m "Initial commit: scan-to-CAD pipeline"

# Create GitHub repo (using gh CLI)
gh repo create scan-to-cad-pipeline --private --source=. --remote=origin

# Push
git push -u origin main
```

## Option 2: Add to existing repository

```bash
cd /opt/data/cad-pipeline

git init
git add .
git commit -m "Initial commit: scan-to-CAD pipeline"

# Add your existing repo as remote
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## Deploy Key Setup (for AI PC pull access)

1. **Generate SSH key on AI PC:**
   ```bash
   ssh-keygen -t ed25519 -C "ai-pc-deploy-key" -f ~/.ssh/cad_pipeline_deploy
   cat ~/.ssh/cad_pipeline_deploy.pub
   ```

2. **Add deploy key to GitHub:**
   - Go to repo Settings → Deploy keys → Add deploy key
   - Paste the public key
   - Name: `AI PC Deploy Key`
   - Check "Allow write access" if the AI PC will push results

3. **Configure SSH on AI PC:**
   ```bash
   # Add to ~/.ssh/config
   Host github.com
     HostName github.com
     User git
     IdentityFile ~/.ssh/cad_pipeline_deploy
   ```

4. **Clone on AI PC:**
   ```bash
   git clone git@github.com:YOUR_USERNAME/scan-to-cad-pipeline.git
   ```

## Environment Variables

Create `.env` file (not committed):

```bash
LM_API_KEY="your-lm-studio-api-key"
```

## .gitignore

Already configured to exclude:
- `node_modules/`
- `dist/` (build artifacts)
- `.env` (secrets)
- `output/` (pipeline artifacts)
- `*.stl`, `*.step`, `*.scad` (runtime files)

Build artifacts are excluded, so after cloning run:
```bash
npm install
npm run build
```
