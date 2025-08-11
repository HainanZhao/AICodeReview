# Release Process

This document describes how to create releases for the AI Code Review CLI tool.

## Automated GitHub Releases

The repository is configured with GitHub Actions that automatically handle releases when version tags are pushed.

### Prerequisites

1. **NPM Token**: Add your npm authentication token as a repository secret named `NPM_TOKEN`
   - Go to: Repository Settings → Secrets and variables → Actions
   - Add a new secret: `NPM_TOKEN` with your npm token value
   - Get your npm token: `npm login` then `npm token create`

2. **GitHub CLI** (optional, for manual releases): Install `gh` CLI tool

### Method 1: Using the Release Script (Recommended)

1. **Update CHANGELOG.md** with your new version:
   ```markdown
   ## [1.4.0] - 2025-08-11
   ### Added
   - Your new features here
   ```

2. **Run the release script**:
   ```bash
   ./scripts/release.sh 1.4.0
   ```

   The script will:
   - Validate the version format
   - Check that the version exists in CHANGELOG.md
   - Update package.json
   - Run tests and build
   - Create and push git tag
   - Trigger automated GitHub release

### Method 2: Manual GitHub Actions

1. Go to your repository's **Actions** tab
2. Select **"Manual Release"** workflow
3. Click **"Run workflow"**
4. Enter the version number (e.g., `1.4.0`)
5. Choose whether to publish to npm
6. Click **"Run workflow"**

### Method 3: Git Tag (Automatic)

1. Update package.json version: `npm version 1.4.0 --no-git-tag-version`
2. Commit changes: `git commit -am "chore: bump version to 1.4.0"`
3. Create and push tag:
   ```bash
   git tag -a v1.4.0 -m "Release v1.4.0"
   git push origin v1.4.0
   ```

## What Happens During Release

1. **Automated Testing**: Runs test suite
2. **Build Process**: Compiles TypeScript and builds frontend
3. **Package Creation**: Creates npm package (.tgz file)
4. **GitHub Release**: Creates release with:
   - Extracted changelog notes
   - Attached npm package
   - Proper semantic version tagging
5. **NPM Publishing**: Publishes to npm registry (if not a pre-release)

## Release Notes

Release notes are automatically extracted from `CHANGELOG.md` based on the version number. Make sure your changelog follows this format:

```markdown
## [1.4.0] - 2025-08-11

### Added
- New feature descriptions

### Changed
- Modified feature descriptions

### Fixed
- Bug fix descriptions
```

## Troubleshooting

### NPM Publishing Fails
- Check that `NPM_TOKEN` secret is set correctly
- Verify you have publishing rights to the `aicodereview-cli` package
- Ensure the version doesn't already exist on npm

### GitHub Release Fails
- Check repository permissions
- Verify the `GITHUB_TOKEN` has sufficient permissions
- Ensure the tag doesn't already exist

### Manual Recovery

If automated release fails, you can create a manual release:

```bash
# Create GitHub release manually
gh release create v1.4.0 \
  --title "Release v1.4.0" \
  --notes-file release_notes.md \
  ./aicodereview-cli-1.4.0.tgz

# Publish to npm manually
npm publish
```

## Version Strategy

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x.x): Breaking changes
- **MINOR** (x.1.x): New features, backwards compatible
- **PATCH** (x.x.1): Bug fixes, backwards compatible

### Current Release Process for v1.4.0

Since you're currently on version 1.4.0 with the new features:

1. Your changelog is already updated ✅
2. Your package.json is at 1.4.0 ✅
3. Now you can run: `./scripts/release.sh 1.4.0`

This will create the GitHub release and publish to npm automatically!
