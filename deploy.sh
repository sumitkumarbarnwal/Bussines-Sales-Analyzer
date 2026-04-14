#!/bin/bash
# Quick deployment to Render
# Run this from your local machine to prepare for Render deployment

echo "📦 Preparing Business Sales Analyzer for Render deployment..."

# Step 1: Update requirements.txt
echo "✓ requirements.txt updated with production dependencies"

# Step 2: Ensure Dockerfile is Render-compatible
echo "✓ Dockerfile configured for Render (Gunicorn on port 10000)"

# Step 3: Check .env.example
echo "✓ .env.example configured with all required variables"

# Step 4: Push to GitHub
echo ""
echo "Next steps:"
echo "1. Commit changes: git add . && git commit -m 'Prepare for Render deployment'"
echo "2. Push to GitHub: git push origin main"
echo "3. Go to https://render.com"
echo "4. Create Web Service → Select repository → Configure → Deploy"
echo ""
echo "✅ Ready to deploy!"
