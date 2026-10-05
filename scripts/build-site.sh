#!/bin/sh
# Assembles the static demo site in site/ (demo app with its samples, the library build and the icon)
set -e
cd "$(dirname "$0")/.."
rm -rf site
mkdir -p site/assets
cp -R demo dist site/
cp assets/icon.svg site/assets/
printf '/ /demo/ 302\n' > site/_redirects
echo "Site built in site/"
