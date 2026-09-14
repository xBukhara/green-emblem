#!/usr/bin/env bash
# Downloads the official King Fahd Complex Uthmani Hafs font into
# public/fonts/ as the offline fallback for the Quran reader.
#
#   bash scripts/fetch-quran-font.sh
#
# The app loads this font from the Quran Foundation CDN first (so you get
# their corrections automatically); this local copy is what keeps the mushaf
# rendering when the reader is opened offline as an installed PWA.
#
# Re-run it whenever the Complex publishes a new version.
set -euo pipefail

CDN="https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs"
FILE="UthmanicHafs1Ver18.woff2"
DEST="public/fonts"

if [ ! -d public ]; then
  echo "✗ Run this from the root of the green-emblem project."
  exit 1
fi

mkdir -p "$DEST"
echo "→ Downloading $FILE from the Quran Foundation CDN"
curl -fSL --retry 3 -o "$DEST/$FILE.tmp" "$CDN/$FILE"

# A truncated or HTML error page must never be installed as the Quran font.
BYTES=$(wc -c < "$DEST/$FILE.tmp")
if [ "$BYTES" -lt 50000 ]; then
  rm -f "$DEST/$FILE.tmp"
  echo "✗ Downloaded file is only $BYTES bytes — that is not the font."
  echo "  Nothing was installed. Check your connection and try again."
  exit 1
fi
# woff2 files begin with the ASCII magic "wOF2".
MAGIC=$(head -c 4 "$DEST/$FILE.tmp")
if [ "$MAGIC" != "wOF2" ]; then
  rm -f "$DEST/$FILE.tmp"
  echo "✗ Downloaded file is not a woff2 font (magic was '$MAGIC')."
  echo "  Nothing was installed."
  exit 1
fi

mv "$DEST/$FILE.tmp" "$DEST/$FILE"
echo "✓ Installed $DEST/$FILE ($BYTES bytes)"
echo
echo "  Commit it so Vercel serves it:"
echo "    git add $DEST/$FILE && git commit -m 'add offline Uthmani Hafs font'"
echo
echo "  Font terms: http://dm.qurancomplex.gov.sa/copyright-2/"
