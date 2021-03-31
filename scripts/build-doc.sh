set -ex
if [ -d doc ]; then
   rm -rf doc
fi   
npx typedoc --out doc ./src

