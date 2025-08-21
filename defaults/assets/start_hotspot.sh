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

AP_IF="muon0"

PHY=$(iw dev "$WIFI_INTERFACE" info 2>/dev/null | awk '/wiphy/ {print "phy"$2}')
if [ -z "$PHY" ]; then
    echo "Error: Unable to determine the PHY for interface $WIFI_INTERFACE."
    exit 1
fi
echo "Using PHY $PHY to create $AP_IF"

# Step 1: Stop Network Services
echo "Stopping network services..."
sudo systemctl stop NetworkManager
sudo systemctl stop iwd
if [ $? -ne 0 ]; then
    echo "Failed to stop network services."
    exit 1
fi
echo "Network services stopped."

# Step 2: Create AP interface (muon0) and configure static IP there
echo "Setting static IP for $AP_IF on $PHY"

# If muon0 already exists from a previous run, remove it cleanly
if ip link show "$AP_IF" >/dev/null 2>&1; then
  echo "$AP_IF already exists; deleting it first..."
  sudo iw dev "$AP_IF" del || true
  sleep 0.5
fi

echo "Bringing down $WIFI_INTERFACE to prepare for $AP_IF..."
sudo ip link set "$WIFI_INTERFACE" down

# Create a new virtual interface on the same PHY
if ! sudo iw phy "$PHY" interface add "$AP_IF" type __ap; then
  echo "Failed to create $AP_IF on $PHY."
  exit 1
fi

# Bring it up
sudo ip link set "$AP_IF" up

# Assign the static IP to muon0
echo "Assigning IP $STATIC_IP/24 to $AP_IF..."
sudo ip addr flush dev "$AP_IF" || true
sudo ip addr add "$STATIC_IP/24" dev "$AP_IF"
sleep 1

# Validate the IP assignment
echo "Validating IP assignment on $AP_IF..."
FINAL_IP_CHECK=$(ip addr show "$AP_IF" | grep -oP 'inet \K[\d.]+')
if [ "$FINAL_IP_CHECK" != "$STATIC_IP" ]; then
  echo "Failed to assign IP $STATIC_IP to $AP_IF."
  exit 1
else
  echo "Successfully assigned IP $STATIC_IP to $AP_IF."
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
interface=$AP_IF
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
if [ -e "$CTRL_INTERFACE_DIR/$AP_IF" ]; then
    echo "Control interface socket exists."
else
    echo "Control interface socket not found. Check hostapd logs for issues."
    exit 1
fi

# Test hostapd_cli connection
echo "Testing hostapd_cli connection..."
sudo hostapd_cli -p "$CTRL_INTERFACE_DIR" -i "$AP_IF" status
if [ $? -ne 0 ]; then
    echo "Failed to connect to hostapd using hostapd_cli."
    exit 1
fi
echo "hostapd_cli connection successful."

echo "Hotspot setup complete."

exit 0