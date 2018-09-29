#!/bin/bash

if [ ! -f admins.json ]; then
    touch admins.json
    echo "[]" >> admins.json
else
    echo "admins.json already exists, not overwriting"
fi


if [ ! -f token.json ]; then
    touch token.json
    echo "{\"test\": \"TESTING-TOKEN\",\"main\": \"MAIN-TOKEN\"}" >> token.json
else
    echo "token.json already exists, not overwriting"
fi

# echo "removing old node modules"
# rm -rf node_modules
# echo "installing dependecies"
# npm install