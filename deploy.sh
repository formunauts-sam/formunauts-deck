#!/usr/bin/env bash
# ============================================================
# deploy.sh — one-shot: publish the deck to GitHub Pages via gh.
# Account: formunauts-sam (gh active). Repo: formunauts-deck.
# Re-running just pushes the latest commit → same link updates.
# ============================================================
set -euo pipefail

# Override the target repo:  ./deploy.sh owner/repo   or   DECK_REPO=owner/repo ./deploy.sh
REPO="${1:-${DECK_REPO:-formunauts-sam/formunauts-deck}}"
BRANCH="main"

cd "$(dirname "$0")"

# 0. GUARDRAIL: every deck in the manifest must validate before we publish.
#    A typo'd field renders empty at runtime; the validator catches it here so
#    a broken deck can never go live. Skip with SKIP_VALIDATE=1 in a pinch.
if [ "${SKIP_VALIDATE:-0}" != "1" ] && command -v node >/dev/null 2>&1; then
  echo "· validating decks…"
  if ! node tools/validate-deck.mjs --all; then
    echo "✗ deck validation failed — fix the errors above or re-run with SKIP_VALIDATE=1" >&2
    exit 1
  fi
fi

# 1. git init (idempotent) + .nojekyll so dist/ & plugin/ serve verbatim
[ -d .git ] || git init -b "$BRANCH"
touch .nojekyll

git add -A
git commit -m "feat: formunauts marketing demo deck" || echo "· nothing new to commit"

# 2. create the repo the first time (public → Pages is free), else just push
if gh repo view "$REPO" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/${REPO}.git"
  git push -u origin "$BRANCH"
else
  gh repo create "$REPO" --public --source=. --push
fi

# 3. enable Pages (serve repo root of main). Ignore error if already on.
gh api -X POST "repos/${REPO}/pages" \
  -f "source[branch]=${BRANCH}" -f "source[path]=/" 2>/dev/null \
  || echo "· Pages already enabled (or will be — check Settings ▸ Pages)"

echo ""
echo "✓ Live within ~1 min at: https://formunauts-sam.github.io/formunauts-deck/"
echo "  Update later: git add -A && git commit -m '...' && git push"
