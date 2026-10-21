#!/usr/bin/env bash
# Scarica i caratteri (licenza SIL OFL) da npm e li copia in dist/fonts/,
# così il sito non contatta Google Fonts. Usato dal build su GitHub Actions;
# in locale, senza questo passaggio, la pagina usa i caratteri di sistema.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=dist/fonts
TMP=$(mktemp -d)
mkdir -p "$DEST"

fetch() { # pacchetto, cartella di estrazione
  (cd "$TMP" && npm pack --silent "$1" >/dev/null && mkdir -p "$2" && tar -xzf ./*.tgz -C "$2" && rm ./*.tgz)
}

pick() { # cartella, destinazione, modelli in ordine di preferenza
  local dir=$1 out=$2; shift 2
  for pat in "$@"; do
    f=$(ls "$dir"/package/files/ 2>/dev/null | grep -E "$pat" | head -1 || true)
    if [ -n "$f" ]; then cp "$dir/package/files/$f" "$DEST/$out"; echo "  $out <- $f"; return 0; fi
  done
  echo "✗ nessun file trovato in $dir per: $*" >&2; ls "$dir/package/files" >&2; exit 1
}

fetch @fontsource-variable/archivo@5 archivo
fetch @fontsource/jetbrains-mono@5 mono

pick "$TMP/archivo" archivo.woff2 '^archivo-latin-full-normal\.woff2$' '^archivo-latin-wdth-normal\.woff2$' '^archivo-latin-wght-normal\.woff2$'
pick "$TMP/mono" jetbrains-mono-400.woff2 '^jetbrains-mono-latin-400-normal\.woff2$'
pick "$TMP/mono" jetbrains-mono-500.woff2 '^jetbrains-mono-latin-500-normal\.woff2$'
cp "$TMP/archivo/package/LICENSE" "$DEST/LICENSE-archivo.txt"
cp "$TMP/mono/package/LICENSE" "$DEST/LICENSE-jetbrains-mono.txt"
rm -rf "$TMP"
echo "✓ caratteri in $DEST"
