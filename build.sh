set -xe
node_modules/.bin/webpack --config webpack-workers.conf.js
(cd elm && ./build.sh)
