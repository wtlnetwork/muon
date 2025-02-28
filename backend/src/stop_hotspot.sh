#!/bin/bash

WIFI_INTERFACE=$1

echo "Stopping hotspot on $WIFI_INTERFACE..."

# Get the active connection on this interface
HOTSPOT_NAME=$(nmcli connection show --active | grep "$WIFI_INTERFACE" | awk '{print $1}')

if [ ! -z "$HOTSPOT_NAME" ]; then
    # Check if it's actually in AP mode before deleting
    MODE=$(nmcli -t -f 802-11-wireless.mode connection show "$HOTSPOT_NAME" | awk -F: '{print $2}' | uniq)
    if [ "$MODE" == "ap" ]; then
        echo "Stopping hotspot: $HOTSPOT_NAME"
        sudo nmcli connection down "$HOTSPOT_NAME"
        sudo nmcli connection delete "$HOTSPOT_NAME"
        echo "Hotspot stopped and deleted."
        
        echo "Resetting $WIFI_INTERFACE to managed mode..."
        sudo nmcli dev set "$WIFI_INTERFACE" managed yes
        
        echo "Restarting NetworkManager..."
        sudo systemctl restart NetworkManager
        echo "WiFi interface is back to managed mode."
    else
        echo "Connection is not a hotspot. Leaving it intact."
    fi
else
    echo "No active connection found on $WIFI_INTERFACE."
fi

echo "Hotspot stopped (if active) and other connections preserved."

exit 0
