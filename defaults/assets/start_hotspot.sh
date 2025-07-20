#!/bin/bash

# Input Parameters
WIFI_INTERFACE=$1
STATIC_IP=$2
SSID=$3
PASSPHRASE=$4
HOSTAPD_CONF="/tmp/hostapd.conf"
CTRL_INTERFACE_DIR="/var/run/hostapd"

echo "Starting hotspot setup..."
echo "WiFi Interface: $WIFI_INTERFACE"
echo "Static IP: $STATIC_IP"
echo "SSID: $SSID"
echo "Passphrase: $PASSPHRASE"

# Step 1: Stop Network Services
echo "Stopping network services..."
sudo systemctl stop NetworkManager
sudo systemctl stop iwd
if [ $? -ne 0 ]; then
    echo "Failed to stop network services."
    exit 1
fi
echo "Network services stopped."

# Step 2: Configure Static IP
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

# Step 3: Prepare Control Interface Directory
echo "Ensuring control interface directory exists..."

# Create the control directory if it doesn't exist
if [ ! -d "$CTRL_INTERFACE_DIR" ]; then
    echo "Creating control interface directory: $CTRL_INTERFACE_DIR"
    sudo mkdir -p "$CTRL_INTERFACE_DIR"
fi

# Set the correct permissions
echo "Setting correct permissions for control interface directory..."
sudo chown root:root "$CTRL_INTERFACE_DIR"
sudo chmod 755 "$CTRL_INTERFACE_DIR"
echo "Control interface directory is ready."

# Step 4: Start Hotspot
echo "Starting hotspot with SSID: $SSID"

# Generate hostapd configuration
echo "Generating hostapd configuration..."
cat <<EOT | sudo tee $HOSTAPD_CONF > /dev/null
interface=$WIFI_INTERFACE
driver=nl80211
ssid=$SSID
hw_mode=g
channel=6
wpa=2
wpa_passphrase=$PASSPHRASE
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP

# Control interface for hostapd_cli communication
ctrl_interface=$CTRL_INTERFACE_DIR
ctrl_interface_group=0
deny_mac_file=/etc/hostapd/hostapd.deny
EOT
echo "Hostapd configuration generated."

# Start hostapd
echo "Starting hostapd..."
sudo hostapd $HOSTAPD_CONF -B
if [ $? -ne 0 ]; then
    echo "Failed to start hostapd."
    exit 1
fi
echo "Hotspot started successfully."

# Step 5: Verify Hostapd Control Interface
echo "Verifying hostapd control interface..."

# Check if the control socket was created
if [ -e "$CTRL_INTERFACE_DIR/$WIFI_INTERFACE" ]; then
    echo "Control interface socket exists."
else
    echo "Control interface socket not found. Check hostapd logs for issues."
    exit 1
fi

# Test hostapd_cli connection
echo "Testing hostapd_cli connection..."
sudo hostapd_cli -p "$CTRL_INTERFACE_DIR" -i "$WIFI_INTERFACE" status
if [ $? -ne 0 ]; then
    echo "Failed to connect to hostapd using hostapd_cli."
    exit 1
fi
echo "hostapd_cli connection successful."

echo "Hotspot setup complete."

exit 0