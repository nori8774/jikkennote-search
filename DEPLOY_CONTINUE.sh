#!/bin/bash
# 実験ノート検索システム - Cloud Run デプロイスクリプト
# Docker Desktop が起動していることを確認してから実行してください

set -e  # エラーが発生したら停止

echo "============================================"
echo "実験ノート検索システム - Cloud Run デプロイ"
echo "============================================"
echo ""

# 環境変数の設定
export PROJECT_ID="jikkennote-search"
export REGION="asia-northeast1"
export IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/jikkennote-repo/backend:latest"

echo "プロジェクト: $PROJECT_ID"
echo "リージョン: $REGION"
echo "イメージ: $IMAGE_NAME"
echo ""

# ステップ1: Dockerイメージのビルド
echo "ステップ1: Dockerイメージをビルド中..."
docker build -t $IMAGE_NAME ./backend
echo "✅ ビルド完了"
echo ""

# ステップ2: イメージをArtifact Registryにプッシュ
echo "ステップ2: イメージをプッシュ中..."
docker push $IMAGE_NAME
echo "✅ プッシュ完了"
echo ""

# ステップ3: Cloud Runにデプロイ
echo "ステップ3: Cloud Runにデプロイ中..."
gcloud run deploy jikkennote-backend \
    --image=$IMAGE_NAME \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --port=8000 \
    --memory=2Gi \
    --cpu=2 \
    --timeout=300 \
    --max-instances=10 \
    --set-env-vars="HOST=0.0.0.0,PORT=8000,CORS_ORIGINS=http://localhost:3000" \
    --project=$PROJECT_ID
echo ""
echo "✅ デプロイ完了"
echo ""

# デプロイされたURLを取得
echo "============================================"
echo "デプロイ情報"
echo "============================================"
BACKEND_URL=$(gcloud run services describe jikkennote-backend \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(status.url)")

echo "バックエンドURL: $BACKEND_URL"
echo ""

# ヘルスチェック
echo "ヘルスチェック実行中..."
curl -s $BACKEND_URL/health | jq '.'
echo ""

echo "============================================"
echo "次のステップ"
echo "============================================"
echo "1. フロントエンドをVercelにデプロイ"
echo "   - https://vercel.com/ でプロジェクトをインポート"
echo "   - Root Directory: frontend"
echo "   - 環境変数: NEXT_PUBLIC_API_URL=$BACKEND_URL"
echo ""
echo "2. Vercelデプロイ後、CORS設定を更新"
echo "   gcloud run services update jikkennote-backend \\"
echo "       --region=$REGION \\"
echo "       --update-env-vars=\"CORS_ORIGINS=https://YOUR-VERCEL-URL.vercel.app,http://localhost:3000\" \\"
echo "       --project=$PROJECT_ID"
echo ""
echo "3. 動作確認"
echo "   - フロントエンドURL: https://YOUR-VERCEL-URL.vercel.app"
echo "   - バックエンドURL: $BACKEND_URL"
echo ""
echo "デプロイが完了しました！🎉"
