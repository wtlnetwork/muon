#!/bin/bash

WIFI_INTERFACE=$1
AP_IF="muon0"

echo "Restoring network configuration for $WIFI_INTERFACE..."

# Stop the hostapd and dnsmasq services
echo "Stopping hostapd and dnsmasq..."
sudo pkill -x hostapd
sudo pkill -x dnsmasq
sudo rm -f /var/run/hostapd/*

# Remove the virtual AP interface if it exists
if ip link show "$AP_IF" >/dev/null 2>&1; then
    echo "Removing AP interface $AP_IF..."
    sudo ip link set "$AP_IF" down
    sudo iw dev "$AP_IF" del
fi

# Restart network services
echo "Restarting NetworkManager and iwd..."
sudo systemctl restart NetworkManager
sudo systemctl restart iwd

# Step 5: Bring the main Wi-Fi interface back up
sudo ip link set "$WIFI_INTERFACE" up

echo "Network configuration restored successfully."
