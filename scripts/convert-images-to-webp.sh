#!/usr/bin/env bash
set -euo pipefail

if ! command -v cwebp &> /dev/null; then
  echo "Error: cwebp is not installed."
  echo "  macOS:  brew install webp"
  echo "  Ubuntu: apt install webp"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_DIR="$PROJECT_ROOT/data/images"
BOOKS_JSON="$PROJECT_ROOT/data/books.json"

# Capture size before conversion
size_before=$(du -sm "$IMAGES_DIR" | cut -f1)

# Count files first
total=$(find "$IMAGES_DIR" -name "*.jpg" -type f | wc -l | tr -d ' ')

if [ "$total" -eq 0 ]; then
  echo "No .jpg files found in $IMAGES_DIR. Nothing to convert."
  exit 0
fi

echo "Found $total .jpg files to process."

converted=0
skipped=0
failed=0
count=0

while IFS= read -r -d '' jpg; do
  webp="${jpg%.jpg}.webp"
  count=$((count + 1))

  # Skip if .webp already exists
  if [ -f "$webp" ]; then
    skipped=$((skipped + 1))
    # Delete leftover .jpg if .webp exists and is non-empty
    if [ -s "$webp" ]; then
      rm -f "$jpg"
    fi
    # Progress every 500 files
    if [ $((count % 500)) -eq 0 ] || [ "$count" -eq "$total" ]; then
      echo "Progress: $count / $total (converted: $converted, skipped: $skipped, failed: $failed)"
    fi
    continue
  fi

  # Convert
  if cwebp -q 65 "$jpg" -o "$webp" -quiet 2>/dev/null; then
    # Verify .webp was created and is non-empty before deleting original
    if [ -s "$webp" ]; then
      rm -f "$jpg"
      converted=$((converted + 1))
    else
      echo "Warning: $webp is empty, keeping original .jpg"
      rm -f "$webp"
      failed=$((failed + 1))
    fi
  else
    echo "Error converting: $jpg"
    failed=$((failed + 1))
  fi

  # Progress every 500 files
  if [ $((count % 500)) -eq 0 ] || [ "$count" -eq "$total" ]; then
    echo "Progress: $count / $total (converted: $converted, skipped: $skipped, failed: $failed)"
  fi
done < <(find "$IMAGES_DIR" -name "*.jpg" -type f -print0)

# Update books.json: replace .jpg with .webp in image paths
if [ -f "$BOOKS_JSON" ]; then
  sed -i '' 's/\.jpg"/.webp"/g' "$BOOKS_JSON"
  echo "Updated $BOOKS_JSON: .jpg -> .webp"
else
  echo "Warning: $BOOKS_JSON not found, skipping JSON update."
fi

size_after=$(du -sm "$IMAGES_DIR" | cut -f1)

echo ""
echo "=== Conversion Complete ==="
echo "Files converted: $converted"
echo "Files skipped:   $skipped"
echo "Files failed:    $failed"
echo "Size before:     ${size_before} MB"
echo "Size after:      ${size_after} MB"
echo "Space saved:     $((size_before - size_after)) MB"
