#!/bin/bash

set -e 

SYSEXT_DIR="./muon"
SYSEXT_RAW="./muon.raw"
SYSEXT_DESTINATION="/var/lib/extensions/muon.raw"
SYSEXT_RELEASE="${SYSEXT_DIR}/usr/lib/extension-release.d/extension-release.muon"
PACKAGE_LIST="./package_url.list"

OS_ID="ID=steamos"
VERSION_ID=$(grep VERSION_ID /etc/os-release)

mkdir -p "${SYSEXT_DIR}/usr/lib/extension-release.d/"
echo "$OS_ID" > "$SYSEXT_RELEASE"
echo "$VERSION_ID" >> "$SYSEXT_RELEASE"

wget -q -nc -i "$PACKAGE_LIST"

mkdir -p "$SYSEXT_DIR"
for pkg in *.pkg.tar.zst; do
  tar --use-compress-program=unzstd -xf "$pkg" -C "$SYSEXT_DIR"
done

chown -R root:root "$SYSEXT_DIR"
mksquashfs "$SYSEXT_DIR" "$SYSEXT_RAW" -comp zstd -all-root -noappend

mkdir -p /var/lib/extensions
if [ ! -f "$SYSEXT_DEST" ]; then
    ln -s "$PWD/muon.raw" "$SYSEXT_DESTINATION"
else
    echo "Extension already linked."
fi

systemctl enable systemd-sysext
systemctl start systemd-sysext
systemd-sysext refresh

echo "Dependencies installed successfully."