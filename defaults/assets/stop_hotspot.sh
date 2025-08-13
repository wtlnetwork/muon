#!/bin/bash

WIFI_INTERFACE=$1
SSID=$2
CON_NAME="$(echo "$SSID" | sed 's/[^[:alnum:]]/_/g' | sed 's/_\+/_/g' | sed 's/^_//; s/_$//')"
# Backup connection name if the SSID is absent for whatever reason
if [ -z "$CON_NAME" ]; then
  CON_NAME="muon_ap"
fi

echo "Stopping hotspot..."

if nmcli -t -f NAME con show | grep -Fxq "$CON_NAME"; then
    nmcli con down "$CON_NAME" || true
    nmcli con del "$CON_NAME" || true
    echo "Deleted NM connection $CON_NAME."
  else
    echo "No NM connection named $CON_NAME found."
  fi

  nmcli dev set "$WIFI_INTERFACE" managed yes
  nmcli device connect "$WIFI_INTERFACE"

  echo "Hotspot stopped and $WIFI_INTERFACE returned to managed mode."