#!/bin/bash
DNSMASQ_CONFIG="/tmp/dnsmasq-hotspot.conf"
DNSMASQ_LOG="/var/log/dnsmasq.log"
WIFI_INTERFACE=$1
DHCP_RANGE=$2
IP_ADDRESS=$3
AP_IF="muon0"

# Remove old dnsmasq configuration.
if [ -f "$DNSMASQ_CONFIG" ]; then
    echo "Removing old dnsmasq config at $DNSMASQ_CONFIG..."
    sudo rm "$DNSMASQ_CONFIG"
fi

# Generate new dnsmasq config.
echo "Generating new dnsmasq config..."
cat <<EOT > "$DNSMASQ_CONFIG"
interface=$AP_IF
bind-dynamic
dhcp-range=$DHCP_RANGE
dhcp-option=3,$IP_ADDRESS  # Gateway
dhcp-option=6,1.1.1.1,8.8.8.8  # DNS for clients
port=0  # Disable DNS serving
log-dhcp
log-facility=$DNSMASQ_LOG  # Save logs here
dhcp-broadcast
EOT
echo "dnsmasq config generated successfully."

# Stop any running copies of dnsmasq to avoid conflicts.
echo "Stopping any existing dnsmasq instances..."
sudo pkill dnsmasq

# Start dnsmasq
echo "Starting dnsmasq..."
sudo dnsmasq -C "$DNSMASQ_CONFIG" 2>&1 &

# Pause for two seconds to allow dnsmasq to start.
sleep 1

# Check if dnsmasq is running
pgrep dnsmasq > /dev/null

# If dnsmasq is running, exit successfully. Otherwise, exit with an error.
if [ $? -eq 0 ]; then
    echo "dnsmasq is running."
    exit 0
else
    echo "Failed to start dnsmasq."
    exit 1
fi