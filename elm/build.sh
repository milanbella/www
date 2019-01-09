#!/bin/bash
mkdir -p build

if [ -n "$1" ]; then 
	sources=$1
else
	sources="src/Keypad.elm"
fi

set -x
rm build/*
elm make $sources --output build/elm.js
cp src/styles.css build/
mkdir -p ../src/assets/elm
rm ../src/assets/elm/*
cp build/* ../src/assets/elm
set +x
