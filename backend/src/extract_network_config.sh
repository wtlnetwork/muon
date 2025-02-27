#!/bin/bash

# Obtain WiFi interface from shell arguments
WIFI_INTERFACE=$1

# Extract IP Address
IP_ADDRESS=$(ip addr show "$WIFI_INTERFACE" | grep -oP 'inet \K[\d.]+')

# Extract default gateway
GATEWAY=$(ip route show default | awk '/default/ {print $3}')

# Extract DNS server settings
if command -v resolvectl > /dev/null; then
    DNS_SERVERS=$(resolvectl status | grep -oP 'DNS Servers: \K[\d. ]+' | tr ' ' ',')
else
    DNS_SERVERS=$(grep -oP 'nameserver \K[\d.]+' /etc/resolv.conf | tr '\n' ',' | sed 's/,$//')
fi

# Output results in key=value format for easy parsing in Python
echo "IP_ADDRESS=$IP_ADDRESS"
echo "GATEWAY=$GATEWAY"
echo "DNS_SERVERS=$DNS_SERVERS"