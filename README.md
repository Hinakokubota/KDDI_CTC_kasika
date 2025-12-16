# KDDI-CTC Organizational Correlation Viewer

KDDIとCTCの組織相関図を可視化・検索するためのWebアプリケーションです。

## 機能

### 1. 組織ツリー表示
- **左ペイン**: KDDI組織図（初期表示：本部まで展開）
- **右ペイン**: CTC組織図（初期表示：部まで展開）
- **中央**: 相関を示すコネクタ線

### 2. 検索・フィルタリング機能
- **会社選択**: KDDI / CTC
- **検索範囲**: 部署 / 個人名
- **キーワード検索**: 部分一致検索対応

### 3. インタラクティブ機能
- ノードの展開/折りたたみ
- 検索結果のハイライト表示
- 相関する担当者の自動展開
- ビュー切り替え（KDDI View / CTC View / Full View）

## 使い方

### ローカルでの起動方法

1. プロジェクトディレクトリに移動:
```bash
cd KDDI_CTC_kasika
```

2. ローカルサーバーを起動:

**Python 3の場合:**
```bash
python3 -m http.server 8000
```

**Python 2の場合:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.jsの場合:**
```bash
npx http-server -p 8000
```

3. ブラウザで以下のURLを開く:
```
http://localhost:8000
```

### 検索動作の仕様

#### KDDI視点での検索
1. KDDI側の該当部署/個人をハイライト表示
2. 関連するCTC側の組織を**担当者（個人名）まで自動展開**
3. 目的：KDDI担当者がCTCの誰と繋がっているかを明確化

#### CTC視点での検索
1. CTC側の該当部署/個人をハイライト表示
2. 関連するKDDI側の組織を**部まで自動展開**（個人名は非表示）
3. 目的：CTC担当者がKDDIのどの部署と関わりがあるかを把握

## ファイル構成

```
KDDI_CTC_kasika/
├── index.html      # メインHTMLファイル
├── style.css       # スタイルシート
├── script.js       # JavaScript機能
├── data.json       # 組織データと相関データ
└── README.md       # このファイル
```

## データ構造

### 組織階層

**KDDI:**
```
本部 > 部 > 担当者（個人名）
```

**CTC:**
```
本部 > [事業部等] > 部 > 担当者（個人名）
```

### data.jsonの構造
```json
{
  "kddi": {
    "name": "KDDI",
    "children": [ /* 組織ツリー */ ]
  },
  "ctc": {
    "name": "CTC",
    "children": [ /* 組織ツリー */ ]
  },
  "correlations": [
    {
      "kddi": "担当者ID",
      "ctc": "担当者ID"
    }
  ]
}
```

## カスタマイズ

### データの追加・変更
`data.json`を編集することで、組織構造や相関関係を自由に変更できます。

### スタイルの変更
`style.css`を編集することで、デザインをカスタマイズできます。

## ブラウザ対応
- Chrome (推奨)
- Firefox
- Safari
- Edge

## 技術スタック
- HTML5
- CSS3 (Grid, Flexbox)
- JavaScript (ES6+)
- SVG (コネクタ線描画)

## ライセンス
This project is proprietary and confidential.
