#!/bin/bash

# Direct approach to remove API key from git history
API_KEY="REDACTED_API_KEY"

echo "🔒 Starting API key removal from git history..."
echo "⚠️  This will rewrite git history!"

# Create backup
git branch backup-before-cleanup-2

# Use git filter-branch with a more direct approach
git filter-branch --force --tree-filter "
  find . -type f -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.md' | 
  xargs -I {} sed -i 's/${API_KEY}/REDACTED_API_KEY/g' {} 2>/dev/null || true
" --prune-empty --tag-name-filter cat -- --all

echo "✅ History rewrite complete!"
echo ""
echo "Now checking if the API key is still present:"
git log --all --grep="${API_KEY}" || echo "No commits found with the API key"
echo ""
echo "Searching in all files:"
git grep "${API_KEY}" $(git rev-list --all) 2>/dev/null || echo "API key not found in history!"