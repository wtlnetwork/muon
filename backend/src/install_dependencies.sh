#!/bin/bash

# Boolean flags to determine if dnsmasq and hostapd should be installed
INSTALL_DNSMASQ=$1
INSTALL_HOSTAPD=$2

echo "Installing dependencies..."
echo "Install dnsmasq: $INSTALL_DNSMASQ"
echo "Install hostapd: $INSTALL_HOSTAPD"

OS_ID="ID=steamos"
VERSION_ID=$(grep VERSION_ID /etc/os-release)
EXTENSION_NAME="muon-network-tools"
EXTENSION_DIR="/tmp/$EXTENSION_NAME"
EXTENSION_RELEASE="$EXTENSION_DIR/usr/lib/extension-release.d/extension-release.$EXTENSION_NAME"
EXTENSION_SRC="/var/lib/extensions/$EXTENSION_NAME.raw"
EXTENSION_TMP="./$EXTENSION_NAME.raw"

# Ensure the extension directory exists
mkdir -p "$EXTENSION_DIR"
mkdir -p "$EXTENSION_DIR/usr/lib/extension-release.d/"
mkdir -p "$EXTENSION_DIR/var/lib/pacman"

ERROR=false

# Initialize Pacman for the extension
echo "Initializing Pacman database inside the extension..."
sudo pacman-key --init
sudo pacman-key --populate archlinux holo
PACMAN_CMD="sudo pacman --noconfirm --needed --root $EXTENSION_DIR --dbpath $EXTENSION_DIR/var/lib/pacman -Sy"

# Install dnsmasq if needed
if [ "$INSTALL_DNSMASQ" == "true" ]; then
    echo "Installing dnsmasq and dependencies via Pacman..."
    $PACMAN_CMD dnsmasq
    if [ $? -ne 0 ]; then
        echo "Failed to install dnsmasq."
        ERROR=true
    fi
fi

# Install hostapd if needed
if [ "$INSTALL_HOSTAPD" == "true" ]; then
    echo "Installing hostapd and dependencies via Pacman..."
    $PACMAN_CMD hostapd
    if [ $? -ne 0 ]; then
        echo "Failed to install hostapd."
        ERROR=true
    fi
fi

# Ensure the extension release file exists
echo "Creating extension release file..."
echo "$OS_ID" > "$EXTENSION_RELEASE"
echo "$VERSION_ID" >> "$EXTENSION_RELEASE"

# Build the system extension
echo "Building system extension..."
rm -f "$EXTENSION_TMP"
mksquashfs "$EXTENSION_DIR" "$EXTENSION_TMP" -comp xz -b 256K -Xdict-size 64K
echo "SquashFS extension created successfully."

# Move extension to the correct location
mkdir -p /var/lib/extensions
mv -f "$EXTENSION_TMP" "$EXTENSION_SRC"
echo "Extension moved to $EXTENSION_SRC"

# Clean up extracted files to avoid clutter
echo "Cleaning up temporary files..."
rm -rf "$EXTENSION_DIR"

# Enable and refresh system extensions
echo "Refreshing systemd-sysext..."
systemd-sysext refresh

# Check if systemd-sysext loaded it
echo "Checking systemd-sysext status..."
systemd-sysext status

# Debugging: Check installed files
echo "Checking installed dependencies..."
ls -l /var/lib/extensions/ | grep "$EXTENSION_NAME"

# Final check
if [ "$ERROR" == "true" ]; then
    echo "One or more dependencies failed to install."
    exit 1
else
    echo "Dependencies installed successfully."
    exit 0
fi