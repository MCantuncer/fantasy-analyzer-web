#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand).
# Exit 0 skips the deployment, any other exit code builds it.
#
# Vercel bills every build by the started minute times its vCPUs, so a 16 s build
# costs a full minute. Skip builds whose changes cannot alter the site: docs,
# Markdown, GitHub workflows, lint config and test files. GitHub CI still runs
# lint, tests and the build on every pull request.

# Last commit Vercel deployed on this branch; fall back to the parent commit.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"

git diff --quiet "$base" HEAD -- . \
  ':(exclude)docs' \
  ':(exclude).github' \
  ':(exclude,glob)**/*.md' \
  ':(exclude,glob)**/*.test.ts' \
  ':(exclude,glob)**/*.test.tsx' \
  ':(exclude)eslint.config.js'
status=$?

if [ "$status" -eq 0 ]; then
  echo "Only docs, tests or CI files changed since $base: skipping the build."
  exit 0
fi

# 1 = site files changed; anything else (e.g. base commit missing from the
# shallow clone) means we can't tell, so build to be safe.
echo "Building (git diff exit $status against $base)."
exit 1
