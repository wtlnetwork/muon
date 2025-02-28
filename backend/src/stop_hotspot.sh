#!/bin/bash

WIFI_INTERFACE=$1

echo "Stopping hotspot on $WIFI_INTERFACE..."

# Get the active hotspot name (if any)
HOTSPOT_NAME=$(nmcli connection show --active | grep "$WIFI_INTERFACE" | awk '{print $1}')

if [ ! -z "$HOTSPOT_NAME" ]; then
    echo "Stopping and deleting hotspot: $HOTSPOT_NAME"
    sudo nmcli connection down "$HOTSPOT_NAME"
    sudo nmcli connection delete "$HOTSPOT_NAME"
    echo "Hotspot stopped and deleted."
else
    echo "No active hotspot found on $WIFI_INTERFACE."
fi

echo "Hotspot stopped and network interface is back to managed mode."

exit 0