#!/bin/bash

# Script to remove API key from git history
# WARNING: This will rewrite git history!

echo "🔒 Removing API key from git history..."
echo "⚠️  WARNING: This will rewrite git history and require force push!"
echo ""

# The API key to remove
API_KEY="REDACTED_API_KEY"

# Create backup
echo "📦 Creating backup branch..."
git branch backup-before-cleanup

# Use git filter-branch to remove the API key from all files in history
echo "🔧 Rewriting git history to remove API key..."
git filter-branch --force --index-filter \
  "git ls-files -z | xargs -0 sed -i 's/${API_KEY}/REDACTED_API_KEY/g' 2>/dev/null || true" \
  --prune-empty --tag-name-filter cat -- --all

# Alternative method using BFG (if available)
# java -jar bfg.jar --replace-text passwords.txt

echo ""
echo "✅ Git history rewritten!"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Review the changes:"
echo "   git log --oneline --all --grep='${API_KEY}'"
echo ""
echo "2. Force push to GitHub (DANGEROUS - will break other clones):"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. Clean up local repository:"
echo "   rm -rf .git/refs/original/"
echo "   git reflog expire --expire=now --all"
echo "   git gc --prune=now --aggressive"
echo ""
echo "4. Tell all collaborators to re-clone the repository"
echo ""
echo "5. The backup branch 'backup-before-cleanup' contains original history"