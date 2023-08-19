# ジオメトリファイル PNG 出力プログラム

## 目次

- [インストール](#インストール)
- [概要](#概要)
- [起動コマンド](#起動コマンド)
- [コマンドライン引数](#コマンドライン引数)
- [出力先](#出力先)
- [使用ライブラリ](#使用ライブラリ)

<br />

---

<br />

## インストール

<br />

```bash
npm install @shinzo0403/geom-visualizer
```

※ エラーが発生する場合は、[トラブルシューティング](#トラブルシューティング)を参照してください。

<br />

---

<br />

## 実行

<br />

- グローバル

```bash
geom-visualizer
```

- ローカル

```bash
./node_modules/.bin/geom-visualizer
```

<br />

---

<br />

## 概要

<br />

Node.js + TypeScript を使用して、様々な形式のジオメトリファイルを PNG として出力します。全ての工程をストリーミング形式で行っているため、大容量のファイルもインプットできます。

<br />

![sample](./document/example.png)

<br />

全ての拡張子のファイルは一度 GeoJSON Feature にそれぞれ変換されますが、引数にスコアを持つキーを渡すことで、スコアのレンジに対応するカラーグラデーションを作成します。

<br />

---

<br />

## コマンドライン引数

<br />

以下は、プログラム起動時に利用できるオプションの一覧テーブルです。

<br />

| オプション名  | 型     | 説明                                                                             | デフォルト値 |
| ------------- | ------ | -------------------------------------------------------------------------------- | ------------ |
| `inputFile`   | string | 入力ファイルのパス(json,geojson,csv,shp のみ対応)                                | null         |
| `outputDir`   | string | 出力先のディレクトリパス                                                         | out          |
| `title`       | string | キャンバスのタイトル                                                             | -            |
| `encoder`     | string | エンコーダー（[iconv-lite](https://github.com/ashtuchkin/iconv-lite)で有効な値） | utf-8        |
| `canvasWidth` | number | キャンバスの幅                                                                   | 800          |
| `strokeStyle` | string | ストロークスタイル                                                               | #000         |
| `lineWidth`   | number | ラインの幅                                                                       | 1            |
| `fillStyle`   | string | 塗りつぶしスタイル                                                               | red          |
| `bgColor`     | string | 背景色                                                                           | #fff         |
| `scoreKey`    | string | スコアキー                                                                       | null         |

<br />

> **注意**: .shp ファイルは少なくとも.dbf ファイルを含めてください。

<br />

※ インタラクティブにしない場合

```bash
geom-visualizer \
    --inputFile=./sample/sample.geojson \
    --outputDir=./out \
    --title=sample \
    --encoder=utf-8 \
    --canvasWidth=800 \
    --strokeStyle=#000 \
    --lineWidth=1 \
    --fillStyle=red \
    --bgColor=#fff \
    --scoreKey=score
```

<br />

---

<br />

## 使用ライブラリ

<br />

- [**shape**](https://www.npmjs.com/package/sharp)
- [**Turf.js**](https://github.com/Turfjs/turf)
- [**yargs**](https://github.com/yargs/yargs)
- [**inquirer.js**](https://github.com/SBoudrias/Inquirer.js)
- [**csv-parser**](https://github.com/mafintosh/csv-parser)
- [**stream-json**](https://github.com/uhop/stream-json)
- [**shp-stream**](https://github.com/calvinmetcalf/shapefile)
- [**d3**](https://github.com/d3/d3)

<br />

---

<br />

## トラブルシューティング

<br />

- **Q.** `zsh: permission denied: ./node_modules/.bin/geom-visualizer` と表示される

  - **A.** `geom-visualizer` に実行権限が付与されていません。以下のコマンドを実行してください。

    ```bash
    chmod +x ./node_modules/.bin/geom-visualizer
    ```

    <br />

- **Q.** `.shp` ファイルを読み込むとエラーが発生する

  - **A.** `.shp` ファイルは少なくとも `.dbf` ファイルを含めてください。

      <br />

    また、[shp-stream]() に対応する `.shp` ファイルでない場合は読み込むことができません

    <br />

    ドキュメント：

    Caveat emptor: this library is a work in progress and does not currently support all shapefile geometry types (see [shp.js](https://github.com/mbostock/shapefile/blob/master/shp.js) for details). It also only supports dBASE III and has no error checking. Please contribute if you want to help!

<br />

---

<br />

## TODO:

<br />

- `jest` によるテストコードの追加

- `eslint` によるコードの整形

- `postgres` と連携して、データを取得する機能の追加
