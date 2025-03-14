#!/bin/bash

# Check if both packages are already installed. If so, exit.
if pacman -Qi hostapd &>/dev/null && pacman -Qi dnsmasq &>/dev/null; then
    exit 0
fi

OS_ID="ID=steamos"
VERSION_ID=$(grep VERSION_ID /etc/os-release)

# Extension details
EXTENSION_NAME="muon-network-tools"
EXTENSION_DIR="./$EXTENSION_NAME"
EXTENSION_RELEASE="$EXTENSION_DIR/usr/lib/extension-release.d/extension-release.$EXTENSION_NAME"
EXTENSION_SRC="$PWD/$EXTENSION_NAME.raw"
EXTENSION_DEST="/var/lib/extensions/$EXTENSION_NAME.raw"

# Packages to include
PACKAGES=("hostapd" "dnsmasq")

# Create extension directory
mkdir -p "$EXTENSION_DIR/usr/lib/extension-release.d/"
touch "$EXTENSION_RELEASE"

# Function to fetch and extract packages
fetch_package() {
    local package_name=$1

    if ! pacman -Sw --noconfirm "$package_name" 2>&1; then
        exit 1
    fi

    local package_file
    package_file=$(ls /var/cache/pacman/pkg/${package_name}-*.pkg.tar.zst 2>/dev/null | head -n 1)

    if [ ! -f "$package_file" ]; then
        exit 1
    fi

    tar --use-compress-program=unzstd -xvf "$package_file" -C "$EXTENSION_DIR" 2>&1
}

# Fetch all required packages
for pkg in "${PACKAGES[@]}"; do
    fetch_package "$pkg"
done

# Rebuild the extension if the OS version doesn't match
if [ ! $(grep -q "$VERSION_ID" "$EXTENSION_RELEASE") ]; then
    rm -f "$EXTENSION_SRC" "$EXTENSION_RELEASE"
    echo -e "$OS_ID\n$VERSION_ID" > "$EXTENSION_RELEASE"
    chown -R root:root "$EXTENSION_DIR"

    if ! mksquashfs "$EXTENSION_DIR" "$EXTENSION_SRC" -quiet 2>&1; then
        exit 1
    fi
fi

mkdir -p /var/lib/extensions
ln -sf "$EXTENSION_SRC" "$EXTENSION_DEST"

# Ensure systemd-sysext recognizes the extension
if ! systemd-sysext merge 2>&1; then
    exit 1
fi