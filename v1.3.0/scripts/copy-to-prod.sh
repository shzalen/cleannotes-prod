#!/bin/bash
set -e

echo "=== Building for GitHub Pages (base=/cleannotes/) ==="
npm run build:gh-pages

echo "=== Copying dist to D:\\CleanNotepad-Prod\\v1.3.0\\root ==="
target="D:/CleanNotepad-Prod/v1.3.0/root"
rm -rf "$target"/*
mkdir -p "$target"
cp -r dist/* "$target/"
echo "Copied $(ls "$target" | wc -l) items to $target"

echo "=== Rebuilding for local IIS (base=/) ==="
npx vite build

echo "=== Done ==="
