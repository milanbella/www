set -xe

build() {
	cp src/environments/environment.prod.ts src/environments/environment.ts
	rm -rf dist/ && npm run build && scripts/build-workers.sh
	npm run build-cjs
}

build_dev() {
	cp src/environments/environment.dev.ts src/environments/environment.ts
	rm -rf dist/ && npm run build-dev && scripts/build-workers.sh dev
	npm run build-cjs-dev
}

if [ -d node_modules/ ]; then
	rm -rf node_modules/
fi
if [ -f package-lock.json ]; then
  rm package-lock.json
fi
npm install --verbose

set +e
npm run prettier-check
if [ $? -ne 0 ]; then
	set +x
	echo
	echo "code formatting is broken! execute 'npm run prettier-fix' and commit fixed files in git"
	echo
	exit 1
	set -x
fi
set -x

set +e
npm run lint
if [ $? -ne 0 ]; then
	set +x
	echo
	echo "fix lint errors!"
	echo
	exit 1
	set -x
fi
set -e

scripts/check-circular-deps.sh

if [ "$1" = 'dev' ]; then
    build_dev
else
	build
fi
