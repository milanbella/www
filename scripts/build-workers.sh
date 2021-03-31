set -xe

build_dev() {
	node_modules/.bin/webpack --mode=development --config webpack-workers.conf.js
}

build() {
	node_modules/.bin/webpack --mode=production --config webpack-workers.conf.js
}

if [ ! -d dist/assets ]; then
	mkdir -p dist/assets
fi


if [ "$1" = 'dev' ]; then
    build_dev
    exit
fi

build
