#!/usr/bin/env bash
# =============================================================================
# rewrite_commits.sh
# Rewrites every commit's author + committer name (and email) in a GitHub
# repository, then force-pushes all branches and tags.
#
# Usage:
#   chmod +x rewrite_commits.sh
#   ./rewrite_commits.sh <github_token> <new_author_name> <repo_name> [new_email]
#
# Arguments:
#   github_token      – GitHub PAT with `repo` (full) scope
#   new_author_name   – Name to stamp on every commit  (e.g. "Claude Bot")
#   repo_name         – Repository name only, OR owner/repo
#                       Examples: "my-repo"  or  "octocat/my-repo"
#   new_email         – (optional) Email to stamp; defaults to GitHub
#                       noreply address of the authenticated user
#
# Requirements: git, curl, jq
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${CYAN}→${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
die()     { echo -e "${RED}✗${RESET} $*" >&2; exit 1; }

# ── Argument parsing ──────────────────────────────────────────────────────────
GITHUB_TOKEN="${1:-}"
NEW_AUTHOR_NAME="${2:-}"
REPO_ARG="${3:-}"
NEW_AUTHOR_EMAIL="${4:-}"   # optional

if [[ -z "$GITHUB_TOKEN" || -z "$NEW_AUTHOR_NAME" || -z "$REPO_ARG" ]]; then
  echo -e "${BOLD}Usage:${RESET} $0 <github_token> <new_author_name> <repo_name> [new_email]"
  echo ""
  echo "  github_token      GitHub PAT with 'repo' scope"
  echo "  new_author_name   Name to stamp on every commit (quote if it has spaces)"
  echo "  repo_name         Repository name, e.g. my-repo  OR  owner/my-repo"
  echo "  new_email         (optional) Email to stamp on every commit"
  exit 1
fi

# ── Dependency check ──────────────────────────────────────────────────────────
for cmd in git curl jq; do
  command -v "$cmd" &>/dev/null || die "'$cmd' is required but not installed."
done

# ── Resolve owner and repo ────────────────────────────────────────────────────
if [[ "$REPO_ARG" == */* ]]; then
  REPO_OWNER="${REPO_ARG%%/*}"
  REPO_NAME="${REPO_ARG##*/}"
else
  # Fetch authenticated user's login to use as owner
  info "Fetching authenticated GitHub user..."
  _USER_JSON=$(curl -sf \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/user) || die "GitHub API call failed. Is the token valid?"

  REPO_OWNER=$(echo "$_USER_JSON" | jq -r '.login')
  REPO_NAME="$REPO_ARG"

  # Also grab email for default if not supplied
  if [[ -z "$NEW_AUTHOR_EMAIL" ]]; then
    _GH_EMAIL=$(echo "$_USER_JSON" | jq -r '.email // empty')
  fi
fi

[[ -z "$REPO_OWNER" || "$REPO_OWNER" == "null" ]] && \
  die "Could not determine repository owner. Pass it as owner/repo."

# ── Resolve email ─────────────────────────────────────────────────────────────
if [[ -z "$NEW_AUTHOR_EMAIL" ]]; then
  if [[ -n "${_GH_EMAIL:-}" && "$_GH_EMAIL" != "null" ]]; then
    NEW_AUTHOR_EMAIL="$_GH_EMAIL"
  else
    NEW_AUTHOR_EMAIL="${REPO_OWNER}@users.noreply.github.com"
    warn "No email supplied; using GitHub noreply: $NEW_AUTHOR_EMAIL"
  fi
fi

echo ""
echo -e "${BOLD}Repository :${RESET} $REPO_OWNER/$REPO_NAME"
echo -e "${BOLD}New author :${RESET} $NEW_AUTHOR_NAME <$NEW_AUTHOR_EMAIL>"
echo ""

# ── Verify the repo is reachable ──────────────────────────────────────────────
info "Verifying repository access..."
HTTP_STATUS=$(curl -o /dev/null -sw "%{http_code}" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME")

[[ "$HTTP_STATUS" == "200" ]] || \
  die "Repository not accessible (HTTP $HTTP_STATUS). Check token permissions and repo name."

# ── Clone into a temp directory ───────────────────────────────────────────────
WORK_DIR=$(mktemp -d)
REPO_DIR="$WORK_DIR/$REPO_NAME"
trap 'rm -rf "$WORK_DIR"' EXIT

info "Cloning $REPO_OWNER/$REPO_NAME (all branches)..."
git clone --no-local \
  "https://${REPO_OWNER}:${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git" \
  "$REPO_DIR"

cd "$REPO_DIR"

# Configure git identity for this repo
git config user.name  "$NEW_AUTHOR_NAME"
git config user.email "$NEW_AUTHOR_EMAIL"

# ── Check out every remote branch locally ────────────────────────────────────
info "Tracking all remote branches locally..."
git fetch --all --prune

DEFAULT_BRANCH=$(git remote show origin \
  | grep 'HEAD branch' | awk '{print $NF}')

while IFS= read -r remote_branch; do
  # trim any leading/trailing whitespace left by git branch -r
  remote_branch="${remote_branch#"${remote_branch%%[! ]*}"}"
  remote_branch="${remote_branch%"${remote_branch##*[! ]}"}"

  local_branch="${remote_branch#origin/}"

  if git show-ref --verify --quiet "refs/heads/$local_branch" 2>/dev/null; then
    : # already exists locally
  else
    git checkout --track "$remote_branch" -q
  fi
done < <(git branch -r | grep -v '\->')   # skip symbolic-ref lines like HEAD -> origin/main

# Return to default branch
git checkout "$DEFAULT_BRANCH" -q 2>/dev/null || true

# ── Rewrite all commits ───────────────────────────────────────────────────────
info "Rewriting all commits (this may take a moment)..."

# Escape single quotes inside the name/email for the shell heredoc
_NAME="${NEW_AUTHOR_NAME//\\/\\\\}"
_EMAIL="${NEW_AUTHOR_EMAIL//\\/\\\\}"

git filter-branch -f --env-filter "
    export GIT_AUTHOR_NAME='${_NAME}'
    export GIT_COMMITTER_NAME='${_NAME}'
    export GIT_AUTHOR_EMAIL='${_EMAIL}'
    export GIT_COMMITTER_EMAIL='${_EMAIL}'
" --tag-name-filter cat -- --all \
  2>&1 | grep -v "^Ref .* was rewritten$" || true   # suppress noisy per-ref lines

# ── Force-push everything ─────────────────────────────────────────────────────
info "Force-pushing all branches..."
git push origin --force --all

info "Force-pushing all tags..."
git push origin --force --tags

echo ""
success "Done!  All commits in '${REPO_OWNER}/${REPO_NAME}' now carry:"
success "  Author / Committer : $NEW_AUTHOR_NAME <$NEW_AUTHOR_EMAIL>"
echo ""
warn "Reminder: force-pushing rewrites shared history."
warn "Anyone with a local clone must run: git fetch --all && git reset --hard origin/<branch>"

