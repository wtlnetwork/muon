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

# Select binary packages appropriate for this SteamOS generation.
PACKAGES=()

if [ "$OS_ID" == "steamos" ]; then
  # Packages shared between supported SteamOS versions.
  PACKAGES+=(
    "$BIN_DIR/hostapd.pkg.tar.zst"
  )

  # dnsmasq requires different versions between SteamOS 3.8 and 3.9 because of bastard libhogweed dependencies!
  STEAMOS_MAJOR="${VERSION_ID%%.*}"
  STEAMOS_REMAINDER="${VERSION_ID#*.}"
  STEAMOS_MINOR="${STEAMOS_REMAINDER%%.*}"

  if [ "$STEAMOS_MAJOR" -eq 3 ] && [ "$STEAMOS_MINOR" -eq 8 ]; then
    echo "Using dnsmasq version for SteamOS 3.8."
    PACKAGES+=(
      "$BIN_DIR/dnsmasq-steamos38.pkg.tar.zst"
    )

  elif [ "$STEAMOS_MAJOR" -gt 3 ] || \
       { [ "$STEAMOS_MAJOR" -eq 3 ] && [ "$STEAMOS_MINOR" -ge 9 ]; }; then

    echo "Using dnsmasq version for SteamOS 3.9 or later."
    PACKAGES+=(
      "$BIN_DIR/dnsmasq-steamos39.pkg.tar.zst"
    )
  else
    echo "Unsupported SteamOS version: $VERSION_ID"
    exit 1
  fi
fi

# Determine whether to rebuild
SHOULD_REBUILD=false

if [ ! -f "$SYSEXT_RELEASE" ]; then
  echo "No extension-release file found. Rebuilding."
  SHOULD_REBUILD=true
else
  EXT_ID=$(grep -E '^ID=' "$SYSEXT_RELEASE" | cut -d= -f2 | tr -d '"')
  EXT_VERSION_ID=$(grep -E '^VERSION_ID=' "$SYSEXT_RELEASE" | cut -d= -f2 | tr -d '"')

  if [ "$EXT_ID" != "$OS_ID" ] || [ "$EXT_VERSION_ID" != "$VERSION_ID" ]; then
    echo "OS version mismatch in extension-release. Rebuilding."
    echo "Host:      $OS_ID $VERSION_ID"
    echo "Extension: $EXT_ID $EXT_VERSION_ID"
    SHOULD_REBUILD=true
  fi
fi

if [ "$SHOULD_REBUILD" = true ]; then
  echo "Cleaning up old build (if any)..."
  rm -rf "$SYSEXT_DIR"
  rm -f "$SYSEXT_RAW"

  mkdir -p "$SYSEXT_DIR"

  if [ "$OS_ID" == "steamos" ]; then
    echo "Extracting selected SteamOS packages..."

    for pkg in "${PACKAGES[@]}"; do
	  if [ ! -f "$pkg" ]; then
	    echo "Required package not found: $pkg"
	    exit 1
	  fi

	  echo "Extracting $(basename "$pkg")..."
	  tar --use-compress-program=unzstd \
	    -xf "$pkg" \
	    -C "$SYSEXT_DIR"
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

if [ ! -f "$SYSEXT_RAW" ]; then
    echo "Failed to create sysext image."
    exit 1
fi

echo "Muon sysext image is compatible with $OS_ID $VERSION_ID."
exit 0