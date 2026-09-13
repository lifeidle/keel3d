#!/bin/bash
export HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890
PY="C:/Users/chenhua/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
declare -A PACKS=(
  [animatedtanks]="1tHX0RF9l4Nw4EZwxH6xWta0HsICU2h-G"
  [animatedmen]="17LibivOaUidsQhSkcxP3YYvDr0n7wIwu"
  [buildings]="1uWCsV9QfnAu8u_QbwkYwOfuU3McME7CA"
  [ultimategun]="12V-mHNB6bnW2WzgpJfRBQd-TG4pOO3yx"
  [survival]="1NKfC95GMWWJquy6rRzwFVkVDoZ_QP7K_"
  [ships]="1Qf31QTnGfxRzYxx8dHmlVGDT4KmIa0Vy"
  [animatedtanks2]="skip"
  [stylizedtree]="1GlrFUFcNj6KIuc4-QpVEiRcXVUzSClP2"
  [ultimatenature]="1-Kl0L_Jg8awbh0S5T-z3zxh4mVlnxTpa"
)
for name in animatedtanks animatedmen buildings ultimategun survival ships stylizedtree ultimatenature; do
  id=${PACKS[$name]}
  if [ ! -d "assets_new/$name" ] || [ -z "$(ls -A assets_new/$name 2>/dev/null)" ]; then
    echo "=== downloading $name ==="
    "$PY" -m gdown --folder "https://drive.google.com/drive/folders/$id" -O "assets_new/$name" 2>&1 | tail -2
  else
    echo "=== $name already present, skip ==="
  fi
done
echo "=== ALL DONE ==="
ls -la assets_new/
