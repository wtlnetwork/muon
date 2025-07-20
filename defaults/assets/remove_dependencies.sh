#!/bin/bash
rm /var/lib/extensions/muon.raw
systemd-sysext refresh
systemctl restart NetworkManager