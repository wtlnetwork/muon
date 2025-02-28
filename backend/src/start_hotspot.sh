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

# -----------------------------------
# Step 1: Stop Existing Hotspot (if any)
# -----------------------------------
echo "Stopping any existing hotspot on $WIFI_INTERFACE..."
EXISTING_HOTSPOT=$(nmcli connection show --active | grep "$WIFI_INTERFACE" | awk '{print $1}')
if [ ! -z "$EXISTING_HOTSPOT" ]; then
    sudo nmcli connection down "$EXISTING_HOTSPOT"
    sudo nmcli connection delete "$EXISTING_HOTSPOT"
    echo "Existing hotspot stopped and deleted."
else
    echo "No active hotspot found on $WIFI_INTERFACE."
fi

# -----------------------------------
# Step 2: Create New Hotspot
# -----------------------------------
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

# -----------------------------------
# Step 3: Confirmation and Status
# -----------------------------------
echo "Hotspot created successfully!"
nmcli connection show --active | grep "$SSID"

echo "Hotspot Details:"
echo "SSID: $SSID"
echo "Static IP: $STATIC_IP"
echo "Security: WPA2"
echo "WiFi Interface: $WIFI_INTERFACE"

exit 0