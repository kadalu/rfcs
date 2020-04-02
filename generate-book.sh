#!/bin/bash

set -e

mkdir -p src/_data

function set_layout_header()
{
    filename=$1
    echo "---" > src/temp
    echo "layout: docs" >> src/temp
    echo "---" >> src/temp
    cat $filename >> src/temp
    sed -i -e "s#(images/#(/rfcs/images/#g" src/temp
    mv src/temp src/$(basename ${filename})
}

echo "- section: Kadalu RFCs" > src/_data/chapters.yml
echo "  chapters:" >> src/_data/chapters.yml
echo "    - title: Introduction" >> src/_data/chapters.yml
for f in $(ls text/*.md | sort)
do
    echo "    - title: $(basename $f ".md")" >> src/_data/chapters.yml
    cp $f src
    set_layout_header $f
done

cp -r text/images src/

cp README.md src/introduction.md
set_layout_header "src/introduction.md"
