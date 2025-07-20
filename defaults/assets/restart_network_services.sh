#!/bin/bash

echo "Restarting network services..."

sudo systemctl restart NetworkManager
sudo systemctl restart iwd
    
if [ $? -eq 0 ]; then
    exit 0
else
    exit 1
fi