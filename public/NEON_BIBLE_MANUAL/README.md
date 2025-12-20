# NEON_BIBLE Manual - Deployment Notes

## ファイル配置

マニュアルは以下のディレクトリに配置されています：

```
/Users/yuutasakikawa/Documents/NEON_BIBLE_NEO/neon-sim/public/NEON_BIBLE_MANUAL/
├── index.html
├── style.css
└── script.js
```

## アクセス方法

### 開発環境
開発サーバー起動時（`npm run dev`）は、以下のURLでアクセス可能：
```
http://localhost:5173/NEON_BIBLE_MANUAL/index.html
```

### 本番環境
ビルド後（`npm run build`）、`dist/`フォルダにpublicフォルダの内容がコピーされます。
デプロイ後は以下のようなURLでアクセス可能：
```
https://your-domain.com/NEON_BIBLE_MANUAL/index.html
```

## Gitでの管理

publicフォルダ内のファイルは自動的にGit管理下に入ります。通常通りコミット・プッシュできます：

```bash
git add neon-sim/public/NEON_BIBLE_MANUAL/
git commit -m "Add NEON_BIBLE user manual"
git push
```

## GitHub Pagesなどでのデプロイ

ViteプロジェクトをGitHub Pagesなどにデプロイする場合：

1. `npm run build`でビルド
2. `dist/`フォルダの内容をデプロイ
3. マニュアルは自動的に`/NEON_BIBLE_MANUAL/index.html`で公開される

## Header.tsxでのパス

現在のHeader.tsxのパス設定は正しく動作します：
```tsx
window.open('/NEON_BIBLE_MANUAL/index.html', '_blank')
```

このパスは開発環境でも本番環境でも同じように機能します。
