#!/bin/bash

WIFI_INTERFACE=$1
AP_IF="muon0"

echo "Restoring network configuration for $WIFI_INTERFACE..."

# Stop the hostapd and dnsmasq services
echo "Stopping hostapd and dnsmasq..."
sudo pkill -x hostapd || true
sudo pkill -x dnsmasq || true
sudo rm -f /var/run/hostapd/*

# Remove the virtual AP interface if it exists
if ip link show "$AP_IF" >/dev/null 2>&1; then
    echo "Removing AP interface $AP_IF..."
    sudo ip link set "$AP_IF" down || true
    sudo iw dev "$AP_IF" del || true
fi

echo "Network configuration restored successfully."
