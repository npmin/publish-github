#!/bin/bash -e

NAME=publish-github
VER=0.1.0

rm -rf package

O=$(npm pack)
tar xf $O

cd package

git init
git remote add origin git@github.com:npmin/$NAME.git
git add *
git commit -m "$VER"
git tag "$VER"
git push --force -u origin master:"$VER"
