#!/usr/bin/env bash
set -euo pipefail

message="${1:-auto: update AI bot code}"
branch="$(git branch --show-current 2>/dev/null || true)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Folder ini belum menjadi git repository."
  echo "Jalankan:"
  echo "  git init"
  echo "  git add ."
  echo "  git commit -m \"Initial AI bot\""
  echo "  git branch -M main"
  echo "  git remote add origin https://github.com/USERNAME/NAMA-REPO.git"
  echo "  git push -u origin main"
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin belum diset."
  echo "Jalankan:"
  echo "  git remote add origin https://github.com/USERNAME/NAMA-REPO.git"
  exit 1
fi

if [ -z "$branch" ]; then
  branch="main"
  git branch -M "$branch"
fi

git add .

if git diff --cached --quiet; then
  echo "Tidak ada perubahan kode untuk di-commit."
  exit 0
fi

git commit -m "$message"
git push -u origin "$branch"

echo "Kode berhasil di-push ke origin/$branch."
