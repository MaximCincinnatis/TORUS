#!/bin/bash

# Aggressive API key removal from git history
API_KEY="REDACTED_API_KEY"

echo "🔒 Aggressive API key removal from git history..."
echo "⚠️  This will completely rewrite git history!"

# Create backup
git branch backup-before-aggressive-cleanup-3

# First, update all files in the current working directory
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" -o -name "*.txt" -o -name "*.sh" \) -exec sed -i "s/${API_KEY}/REDACTED_API_KEY/g" {} + 2>/dev/null

# Commit current changes if any
git add -A
git commit -m "Remove API key from current files" || true

# Now rewrite history more aggressively
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --tree-filter "
  # Replace in all text files
  find . -type f -exec file {} \; | grep -E 'text|ASCII' | cut -d: -f1 | while read file; do
    if [ -f \"\$file\" ]; then
      sed -i 's/${API_KEY}/REDACTED_API_KEY/g' \"\$file\" 2>/dev/null || true
    fi
  done
  
  # Also explicitly check common file types
  find . -type f \( -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.md' -o -name '*.txt' -o -name '*.yml' -o -name '*.yaml' -o -name '*.sh' -o -name '*.env' -o -name '*.config' \) -exec sed -i 's/${API_KEY}/REDACTED_API_KEY/g' {} + 2>/dev/null || true
" --prune-empty -- --all

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Aggressive history rewrite complete!"
echo ""
echo "Verifying API key removal:"
echo "Searching for API key in all commits..."
git log --all -p | grep "${API_KEY}" || echo "✅ API key not found in commit history!"
echo ""
echo "Searching in all files across all commits..."
git grep "${API_KEY}" $(git rev-list --all) 2>/dev/null || echo "✅ API key not found in any files!"
echo ""
echo "Double-checking with different search method..."
for commit in $(git rev-list --all); do
  git ls-tree -r $commit | while read mode type hash file; do
    if git show $hash 2>/dev/null | grep -q "${API_KEY}"; then
      echo "❌ Found in $commit:$file"
    fi
  done
done 2>/dev/null || echo "✅ Secondary check complete - API key not found!"