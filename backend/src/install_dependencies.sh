#!/bin/bash

# Boolean flags to determine if dnsmasq and hostapd should be installed
INSTALL_DNSMASQ=$1
INSTALL_HOSTAPD=$2

echo "Installing dependencies..."
echo "Install dnsmasq: $INSTALL_DNSMASQ"
echo "Install hostapd: $INSTALL_HOSTAPD"

# Disable SteamOS read-only system state
echo "Disabling SteamOS read-only state..."
sudo steamos-readonly disable

# Initialize and populate Pacman keys
echo "Initializing and populating Pacman keys..."
sudo pacman-key --init
sudo pacman-key --populate archlinux
sudo pacman-key --populate holo

# If dnsmasq is set to install, install it
ERROR=false
if [ "$INSTALL_DNSMASQ" == "true" ]; then
    echo "Installing dnsmasq..."
    sudo pacman -Sy --noconfirm dnsmasq
    if [ $? -ne 0 ]; then
        echo "Failed to install dnsmasq."
        ERROR=true
    fi
fi

# If hostapd is set to install, install it
if [ "$INSTALL_HOSTAPD" == "true" ]; then
    echo "Installing hostapd..."
    sudo pacman -Sy --noconfirm hostapd
    if [ $? -ne 0 ]; then
        echo "Failed to install hostapd."
        ERROR=true
    fi
fi

# If we encountered an error, exit with an error code
if [ "$ERROR" == "true" ]; then
    echo "One or more dependencies failed to install."
    exit 1
else
    echo "Dependencies installed successfully."
    exit 0
fi
