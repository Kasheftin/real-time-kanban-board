#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

cd "$SCRIPTPATH/backend"
npm install
pm2 stop kanban-backend
pm2 delete kanban-backend
pm2 start npm -n "kanban-backend" -e "$SCRIPTPATH/logs/backend.pm2.error.log" -- start

