#!/bin/bash

WIFI_INTERFACE=$1
STATIC_IP=$2
COUNTRY_CODE=$3

HOSTAPD_CONF="/tmp/hostapd.conf"
CTRL_INTERFACE_DIR="/var/run/hostapd"
AP_IF="muon0"

echo "Starting hotspot setup..."
echo "WiFi Interface: $WIFI_INTERFACE"
echo "Static IP: $STATIC_IP"
echo "Country Code: $COUNTRY_CODE"

PHY=$(iw dev "$WIFI_INTERFACE" info 2>/dev/null | awk '/wiphy/ {print "phy"$2}')
if [ -z "$PHY" ]; then
    echo "Error: Unable to determine the PHY for interface $WIFI_INTERFACE."
    exit 1
fi
echo "Using PHY $PHY to create $AP_IF"

# Step 1: Stop network services
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

if ip link show "$AP_IF" >/dev/null 2>&1; then
  echo "$AP_IF already exists; deleting it first..."
  sudo iw dev "$AP_IF" del || true
  sleep 0.5
fi

echo "Bringing down $WIFI_INTERFACE to prepare for $AP_IF..."
sudo ip link set "$WIFI_INTERFACE" down

if ! sudo iw phy "$PHY" interface add "$AP_IF" type __ap; then
  echo "Failed to create $AP_IF on $PHY."
  exit 1
fi

sudo ip link set "$AP_IF" up

# Disable IPv6 on muon0
echo 1 | sudo tee /proc/sys/net/ipv6/conf/"$AP_IF"/disable_ipv6 > /dev/null

echo "Assigning IP $STATIC_IP/24 to $AP_IF..."
sudo ip addr flush dev "$AP_IF" || true
sudo ip addr add "$STATIC_IP/24" dev "$AP_IF"
sleep 1

FINAL_IP_CHECK=$(ip addr show "$AP_IF" | grep -oP 'inet \K[\d.]+')
if [ "$FINAL_IP_CHECK" != "$STATIC_IP" ]; then
  echo "Failed to assign IP $STATIC_IP to $AP_IF."
  exit 1
else
  echo "Successfully assigned IP $STATIC_IP to $AP_IF."
fi

# Step 3: Prepare control interface directory
echo "Ensuring control interface directory exists..."

if [ ! -d "$CTRL_INTERFACE_DIR" ]; then
    echo "Creating control interface directory: $CTRL_INTERFACE_DIR"
    sudo mkdir -p "$CTRL_INTERFACE_DIR"
fi

sudo chown root:root "$CTRL_INTERFACE_DIR"
sudo chmod 755 "$CTRL_INTERFACE_DIR"
echo "Control interface directory is ready."

echo "Checking if hostapd.deny file exists..."
sudo mkdir -p /etc/hostapd
sudo touch /etc/hostapd/hostapd.deny

echo "Applying regulatory domain $COUNTRY_CODE to kernel..."
sudo iw reg set "$COUNTRY_CODE"

# Step 4: Start hotspot
echo "Starting hostapd..."
sudo hostapd $HOSTAPD_CONF -B
if [ $? -ne 0 ]; then
    echo "Failed to start hostapd."
    exit 1
fi
echo "Hotspot started successfully."

# Step 5: Verify hostapd control interface
echo "Verifying hostapd control interface..."

if [ -e "$CTRL_INTERFACE_DIR/$AP_IF" ]; then
    echo "Control interface socket exists."
else
    echo "Control interface socket not found. Check hostapd logs for issues."
    exit 1
fi

echo "Testing hostapd_cli connection..."
sudo hostapd_cli -p "$CTRL_INTERFACE_DIR" -i "$AP_IF" status
if [ $? -ne 0 ]; then
    echo "Failed to connect to hostapd using hostapd_cli."
    exit 1
fi
echo "hostapd_cli connection successful."
echo "Hotspot setup complete."
exit 0