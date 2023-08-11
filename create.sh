#!/bin/bash

# ./inputディレクトリの{.json, .geojson, .csv, .shp}ファイルを検索
files=$(find ./input -type f \( -name "*.json" -o -name "*.geojson" -o -name "*.csv" -o -name "*.shp" \))

# ファイルを選択
select file in $files; do
  if [[ -n $file ]]; then
    echo "Selected file: $file"

    # 選択されたファイルを引数としてsrc/script.tsを実行
    npm run ts-esm ./src/index.ts "$file"
    exit
  else
    echo "Invalid selection"
  fi
done