#!/bin/bash

# Input Parameters
WIFI_INTERFACE=$1
STATIC_IP=$2
SSID=$3
PASSPHRASE=$4
HOSTAPD_CONF="/etc/hostapd/hostapd.conf"

echo "Starting hotspot setup..."
echo "WiFi Interface: $WIFI_INTERFACE"
echo "Static IP: $STATIC_IP"
echo "SSID: $SSID"
echo "Passphrase: $PASSPHRASE"

# -----------------------------------
# Step 1: Stop Network Services
# -----------------------------------
echo "Stopping network services..."
sudo systemctl stop NetworkManager
sudo systemctl stop iwd
if [ $? -ne 0 ]; then
    echo "Failed to stop network services."
    exit 1
fi
echo "Network services stopped."

# -----------------------------------
# Step 2: Configure Static IP
# -----------------------------------
echo "Configuring static IP for $WIFI_INTERFACE..."

# Flush the existing IP configuration from the interface
echo "Flushing existing IP configuration on $WIFI_INTERFACE..."
sudo ip addr flush dev $WIFI_INTERFACE

# Check if the interface already has the correct IP assigned
echo "Checking if $STATIC_IP is already assigned to $WIFI_INTERFACE..."
EXISTING_IP=$(ip addr show $WIFI_INTERFACE | grep -oP 'inet \K[\d.]+')

if [ "$EXISTING_IP" == "$STATIC_IP" ]; then
    echo "IP $STATIC_IP is already assigned to $WIFI_INTERFACE. Skipping re-assignment."
else
    # Assign the static IP to the interface
    echo "Assigning IP $STATIC_IP/24 to $WIFI_INTERFACE..."
    sudo ip addr add "$STATIC_IP/24" dev "$WIFI_INTERFACE"
    sleep 1

    # Validate the IP assignment
    echo "Validating IP assignment..."
    FINAL_IP_CHECK=$(ip addr show $WIFI_INTERFACE | grep "$STATIC_IP")
    if [ -z "$FINAL_IP_CHECK" ]; then
        echo "Failed to assign IP $STATIC_IP to $WIFI_INTERFACE."
        exit 1
    else
        echo "Successfully assigned IP $STATIC_IP to $WIFI_INTERFACE."
    fi
fi

# -----------------------------------
# Step 3: Start Hotspot
# -----------------------------------
echo "Starting hotspot with SSID: $SSID"

# Generate hostapd configuration
echo "Generating hostapd configuration..."
cat <<EOT > $HOSTAPD_CONF
interface=$WIFI_INTERFACE
driver=nl80211
ssid=$SSID
hw_mode=g
channel=6
wpa=2
wpa_passphrase=$PASSPHRASE
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOT
echo "Hostapd configuration generated."

# Restart hostapd
echo "Restarting hostapd..."
sudo systemctl restart hostapd
if [ $? -ne 0 ]; then
    echo "Failed to start hostapd."
    exit 1
fi
echo "Hotspot started successfully."

exit 0