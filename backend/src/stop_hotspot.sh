#!/bin/bash

WIFI_INTERFACE=$1
ORIGINAL_IP=$2
ORIGINAL_GATEWAY=$3
ORIGINAL_DNS=$4

echo "Restoring network configuration for $WIFI_INTERFACE..."

# Stop the hostapd and dnsmasq services
echo "Stopping hostapd and dnsmasq..."
sudo systemctl stop hostapd
sudo pkill dnsmasq

# Switch the WiFi chip back to managed mode (i.e. regular client mode)
echo "Resetting $WIFI_INTERFACE to managed mode..."
sudo ip link set "$WIFI_INTERFACE" down
sudo iw dev "$WIFI_INTERFACE" set type managed
sudo ip link set "$WIFI_INTERFACE" up

# Flush IP configuration
echo "Flushing IP configuration..."
sudo ip addr flush dev $WIFI_INTERFACE

# Restore IP Address
if [ -n "$ORIGINAL_IP" ]; then
    echo "Restoring original IP: $ORIGINAL_IP"
    sudo ip addr add "$ORIGINAL_IP/24" dev "$WIFI_INTERFACE"
fi

# Restore Default Gateway
if [ -n "$ORIGINAL_GATEWAY" ]; then
    echo "Restoring original Gateway: $ORIGINAL_GATEWAY"
    sudo ip route add default via "$ORIGINAL_GATEWAY"
fi

# Restore DNS Servers
if [ -n "$ORIGINAL_DNS" ]; then
    echo "Restoring DNS Servers: $ORIGINAL_DNS"
    DNS_CONFIG=""
    IFS=',' read -ra DNS_ARRAY <<< "$ORIGINAL_DNS"
    for DNS_SERVER in "${DNS_ARRAY[@]}"; do
        DNS_CONFIG+="nameserver $DNS_SERVER"$'\n'
    done
    echo -e "$DNS_CONFIG" | sudo tee /etc/resolv.conf > /dev/null
fi

# Restart network services
echo "Restarting NetworkManager and iwd..."
sudo systemctl restart NetworkManager
sudo systemctl restart iwd

echo "Network configuration restored successfully."