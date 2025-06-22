#!/bin/bash
set -e

SYSEXT_DIR="./muon"
SYSEXT_RAW="./muon.raw"
SYSEXT_DESTINATION="/var/lib/extensions/muon.raw"
SYSEXT_RELEASE="${SYSEXT_DIR}/usr/lib/extension-release.d/extension-release.muon"
PACKAGE_LIST="./package_url.list"

OS_ID="ID=steamos"
VERSION_ID=$(grep VERSION_ID /etc/os-release)

# Download packages if not already there
wget -q -nc -i "$PACKAGE_LIST"

# Determine whether to rebuild
SHOULD_REBUILD=false

if [ ! -f "$SYSEXT_RELEASE" ]; then
  echo "No extension-release file found. Rebuilding."
  SHOULD_REBUILD=true
else
  if ! grep -q "$OS_ID" "$SYSEXT_RELEASE" || ! grep -q "$VERSION_ID" "$SYSEXT_RELEASE"; then
    echo "OS version mismatch in extension-release. Rebuilding."
    SHOULD_REBUILD=true
  fi
fi

if [ "$SHOULD_REBUILD" = true ]; then
  echo "Cleaning up old build (if any)..."
  rm -rf "$SYSEXT_DIR"
  rm -f "$SYSEXT_RAW"

  mkdir -p "$SYSEXT_DIR"

  for pkg in *.pkg.tar.zst; do
    tar --use-compress-program=unzstd -xf "$pkg" -C "$SYSEXT_DIR"
  done

  mkdir -p "$(dirname "$SYSEXT_RELEASE")"
  echo "$OS_ID" > "$SYSEXT_RELEASE"
  echo "$VERSION_ID" >> "$SYSEXT_RELEASE"

  chown -R root:root "$SYSEXT_DIR"

  echo "Creating squashfs image..."
  mksquashfs "$SYSEXT_DIR" "$SYSEXT_RAW" -comp zstd -all-root -noappend
else
  echo "Existing extension-release matches OS version. Skipping rebuild."
fi

# Link the .raw to system extension dir
mkdir -p /var/lib/extensions
if [ ! -f "$SYSEXT_DESTINATION" ]; then
  ln -s "$PWD/muon.raw" "$SYSEXT_DESTINATION"
else
  echo "Extension already linked."
fi

# Enable and refresh systemd-sysext
if ! systemctl is-active --quiet systemd-sysext; then
  systemctl enable systemd-sysext
  systemctl start systemd-sysext
fi

systemd-sysext refresh

echo "Dependencies installed successfully and extension linked."
