#!/bin/bash
#
# rescue-main.sh
#
# Rescues commits stuck on a protected main branch by moving them
# to a new branch and creating a PR.
#
# Usage: ./scripts/rescue-main.sh "PR Title" "PR Body"
#

set -e

# Check arguments
if [ -z "$1" ]; then
  echo "Usage: $0 \"PR Title\" [\"PR Body\"]"
  echo ""
  echo "Example: $0 \"Add authentication\" \"Implements JWT-based auth\""
  exit 1
fi

TITLE="$1"
BODY="${2:-$TITLE}"

# Generate branch name from title (lowercase, replace spaces with hyphens)
BRANCH=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Rescuing commits from protected main"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Branch: $BRANCH"
echo "Title:  $TITLE"
echo "Body:   $BODY"
echo ""

# Check if we're on main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: Not on main branch (currently on '$CURRENT_BRANCH')"
  exit 1
fi

# Check if there are commits ahead of origin/main
git fetch origin
AHEAD=$(git rev-list origin/main..HEAD --count)
if [ "$AHEAD" -eq 0 ]; then
  echo "Error: No local commits ahead of origin/main"
  exit 1
fi

echo "Found $AHEAD commit(s) to rescue"
echo ""

# Create and switch to new branch
echo "→ Creating branch '$BRANCH'..."
git checkout -b "$BRANCH"

# Push the branch
echo "→ Pushing branch to origin..."
git push -u origin "$BRANCH"

# Create PR
echo "→ Creating pull request..."
PR_URL=$(gh pr create --title "$TITLE" --body "$BODY" --head "$BRANCH" --base main)

# Switch back to main and reset
echo "→ Resetting local main to origin/main..."
git checkout main
git reset --hard origin/main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Done!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "PR created: $PR_URL"
echo ""
echo "Your local main is now in sync with origin/main."
echo "Merge the PR on GitHub to complete."
