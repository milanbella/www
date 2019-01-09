Prerequisities
--------------

Install cordova 8
> cordova -v
8.0.0

Install newest LTS node.js version
> node -v
v8.12.0

Build amd run
--------------

Install node.js packages:
> npm install


Execute following commands to build/run on android after fresh hg clone:
> npm install
> ionic cordova platform add android@7.1.1
> ionic cordova run android

Execute following commands to build/run in browser:
> ionic serve
