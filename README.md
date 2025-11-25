# lambda-tenant-isolate

AWS Lambda Tenant Isolation 機能を使用して、単一の Lambda 関数でテナントごとに分離された実行環境を提供するサンプルアプリケーションです。

## アーキテクチャ

```
API Gateway → Lambda 関数（テナント分離実行環境）
```

- リクエストヘッダー `x-tenant-id` でテナントを識別
- API Gateway が `X-Amz-Tenant-Id` ヘッダーとして Lambda に転送
- Lambda の `TenancyConfig: PER_TENANT` により、テナントごとに分離された実行環境で処理
- 各テナントは独立したメモリ空間と実行コンテキストを持つ

## プロジェクト構成

- hello-world/ - Lambda 関数のコード（TypeScript）
- events/ - テスト用のイベントファイル
- hello-world/tests/ - ユニットテスト
- template.yaml - AWS リソース定義

## デプロイ

### 必要なツール

- SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- Node.js 22 - [Install Node.js](https://nodejs.org/en/)
- Docker - [Install Docker](https://hub.docker.com/search/?type=edition&offering=community)

### デプロイ手順

```bash
sam build
sam deploy --guided
```

デプロイ後、出力される API Gateway URL を確認してください。

## 使い方

### API の呼び出し

テナント ID をヘッダーに含めてリクエストを送信:

```bash
curl -H "x-tenant-id: tenant-a" https://<api-id>.execute-api.<region>.amazonaws.com/Prod/hello
```

### ローカルテスト

```bash
sam build
sam local start-api
curl -H "x-tenant-id: tenant-a" http://localhost:3000/hello
```

## テナント分離の仕組み

- Lambda 関数の `TenancyConfig: TenantIsolationMode: PER_TENANT` により自動的にテナント分離
- 新しいテナントは追加の設定なしで自動的に分離された環境で実行
- `context.tenantId` でテナント ID を取得可能
- テナントごとに独立したグローバル変数とメモリ空間

## ログの確認

```bash
sam logs -n HelloWorldFunction --stack-name lambda-tenant-isolate --tail
```

## テスト

```bash
cd hello-world
npm install
npm run test
```

## クリーンアップ

```bash
sam delete --stack-name lambda-tenant-isolate
```

## 参考資料

- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [Lambda Tenant Isolation](https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation.html)
