#!/bin/bash
set -e

ASSETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PLUGIN_DIR="$(dirname "$ASSETS_DIR")"
BIN_DIR="$PLUGIN_DIR/bin"

SYSEXT_DIR="$ASSETS_DIR/muon"
SYSEXT_RAW="$ASSETS_DIR/muon.raw"
SYSEXT_DESTINATION="/var/lib/extensions/muon.raw"
SYSEXT_RELEASE="${SYSEXT_DIR}/usr/lib/extension-release.d/extension-release.muon"

OS_ID=$(grep -E '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
VERSION_ID=$(grep -E '^VERSION_ID=' /etc/os-release | cut -d= -f2 | tr -d '"')

echo "Detected OS: $OS_ID (Version: $VERSION_ID)"

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

  if [ "$OS_ID" == "steamos" ]; then
    for pkg in "$BIN_DIR"/*.pkg.tar.zst; do
      if [ -f "$pkg" ]; then
        tar --use-compress-program=unzstd -xf "$pkg" -C "$SYSEXT_DIR"
      fi
    done
  #elif [[ "$OS_ID" == "bazzite" || "$OS_ID" == "fedora" ]]; then
    #echo "Extracting .rpm packages..."
    #cd "$SYSEXT_DIR"
    #for pkg in "$BIN_DIR"/*.rpm; do
    #  if [ -f "$pkg" ]; then
    #    rpm2cpio "$pkg" | cpio -idmu
    #  fi
    #done
    #cd - > /dev/null
  else
    echo "Unsupported OS: $OS_ID. Exiting."
    exit 1
  fi

  if [ -d "$SYSEXT_DIR/usr/sbin" ]; then
      echo "Moving /usr/sbin to /usr/bin for consistency..."
      mkdir -p "$SYSEXT_DIR/usr/bin"
      mv -n "$SYSEXT_DIR"/usr/sbin/* "$SYSEXT_DIR"/usr/bin/ || true
      rm -rf "$SYSEXT_DIR/usr/sbin"
  fi

  mkdir -p "$(dirname "$SYSEXT_RELEASE")"
  echo "ID=$OS_ID" > "$SYSEXT_RELEASE"
  echo "VERSION_ID=$VERSION_ID" >> "$SYSEXT_RELEASE"

  chown -R root:root "$SYSEXT_DIR"

  echo "Creating squashfs image..."
  mksquashfs "$SYSEXT_DIR" "$SYSEXT_RAW" -comp zstd -all-root -noappend
else
  echo "Existing extension-release matches OS version. Skipping rebuild."
fi

# Link the .raw to system extension dir
mkdir -p /var/lib/extensions
if [ ! -f "$SYSEXT_DESTINATION" ]; then
  echo "Copying extension to $SYSEXT_DESTINATION..."
  cp -f "$SYSEXT_RAW" "$SYSEXT_DESTINATION"
else
  echo "Extension already copied."
fi

# Enable and refresh systemd-sysext
if ! systemctl is-active --quiet systemd-sysext; then
  systemctl enable systemd-sysext
  systemctl start systemd-sysext
fi

systemd-sysext refresh

echo "Dependencies installed successfully and extension linked."