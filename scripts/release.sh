#!/bin/bash

# AI Code Review Release Script
# Usage: ./scripts/release.sh [version]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get version from argument or prompt
if [ -z "$1" ]; then
    echo -n "Enter version (e.g., 1.4.0): "
    read VERSION
else
    VERSION=$1
fi

# Validate version format
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format. Use semantic versioning (e.g., 1.4.0)"
    exit 1
fi

print_status "Starting release process for version $VERSION"

# Check if we're on main/master branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    print_warning "You're not on main/master branch. Current branch: $CURRENT_BRANCH"
    echo -n "Continue anyway? (y/N): "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_error "Aborting release"
        exit 1
    fi
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    git status --short
    exit 1
fi

# Check if version already exists in changelog
if grep -q "## \[$VERSION\]" CHANGELOG.md; then
    print_success "Version $VERSION found in CHANGELOG.md"
else
    print_error "Version $VERSION not found in CHANGELOG.md. Please update the changelog first."
    exit 1
fi

# Update package.json version
print_status "Updating package.json version to $VERSION"
npm version $VERSION --no-git-tag-version

# Install dependencies and build
print_status "Installing dependencies..."
npm ci
cd frontend && npm ci && cd ..

print_status "Running tests..."
npm test -- --run

print_status "Building project..."
npm run build

# Create npm package
print_status "Creating npm package..."
npm pack

# Commit version changes
print_status "Committing version changes..."
git add package.json frontend/package.json 2>/dev/null || git add package.json
git commit -m "chore: bump version to $VERSION"

# Create and push tag
print_status "Creating and pushing git tag v$VERSION..."
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"
git push origin "$CURRENT_BRANCH"

print_success "Release process completed!"
print_status "Next steps:"
echo "  1. The GitHub Action should automatically create a release"
echo "  2. Check GitHub releases page: https://github.com/HainanZhao/AICodeReview/releases"
echo "  3. If auto-publish to npm failed, run: npm publish"
echo ""
print_status "Manual GitHub release creation:"
echo "  gh release create v$VERSION --title 'Release v$VERSION' --notes-from-tag ./aicodereview-cli-$VERSION.tgz"
