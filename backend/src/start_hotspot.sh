#!/bin/bash

# Input Parameters
WIFI_INTERFACE=$1
STATIC_IP=$2
SSID=$3
PASSPHRASE=$4

echo "Starting hotspot setup with nmcli..."
echo "WiFi Interface: $WIFI_INTERFACE"
echo "Static IP: $STATIC_IP"
echo "SSID: $SSID"
echo "Passphrase: $PASSPHRASE"

EXISTING_CONNECTION=$(nmcli -t -f NAME connection show | grep "^$SSID$")
if [ ! -z "$EXISTING_CONNECTION" ]; then
    echo "Removing existing hotspot configuration: $SSID"
    sudo nmcli connection delete "$SSID"
fi

echo "Creating new hotspot with SSID: $SSID"
sudo nmcli connection add type wifi ifname "$WIFI_INTERFACE" mode ap con-name "$SSID" ssid "$SSID"

echo "Setting up hotspot security (WPA2)..."
sudo nmcli connection modify "$SSID" 802-11-wireless-security.key-mgmt wpa-psk
sudo nmcli connection modify "$SSID" 802-11-wireless-security.psk "$PASSPHRASE"

echo "Configuring IP settings..."
sudo nmcli connection modify "$SSID" ipv4.addresses "$STATIC_IP/24"
sudo nmcli connection modify "$SSID" ipv4.method shared

echo "Starting hotspot..."
sudo nmcli connection up "$SSID"

echo "Hotspot created successfully!"
nmcli connection show --active | grep "$SSID"

echo "Hotspot Details:"
echo "SSID: $SSID"
echo "Static IP: $STATIC_IP"
echo "Security: WPA2"
echo "WiFi Interface: $WIFI_INTERFACE"

exit 0
