# lambda-tenant-isolate

テナントごとにサイロ化された Lambda 関数を単一の API Gateway でルーティングするサンプルアプリケーションです。

## アーキテクチャ

```
API Gateway → Router Lambda → テナント別Lambda (A, B, C...)
```

- リクエストヘッダー `x-tenant-id` でテナントを識別
- Router Lambda がテナント ID に基づいて適切な Lambda 関数を呼び出し
- 各テナントの Lambda は完全に分離された環境で実行

## プロジェクト構成

- hello-world - Router Lambda 関数のコード（TypeScript）
- events - テスト用のイベントファイル
- hello-world/tests - ユニットテスト
- template.yaml - AWS リソース定義

If you prefer to use an integrated development environment (IDE) to build and test your application, you can use the AWS Toolkit.  
The AWS Toolkit is an open source plug-in for popular IDEs that uses the SAM CLI to build and deploy serverless applications on AWS. The AWS Toolkit also adds a simplified step-through debugging experience for Lambda function code. See the following links to get started.

- [CLion](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [GoLand](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [IntelliJ](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [WebStorm](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [Rider](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [PhpStorm](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [PyCharm](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [RubyMine](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [DataGrip](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
- [VS Code](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/welcome.html)
- [Visual Studio](https://docs.aws.amazon.com/toolkit-for-visual-studio/latest/user-guide/welcome.html)

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

## テナントの追加

新しいテナント用の Lambda 関数を追加するには:

1. `template.yaml` に新しい Lambda 関数リソースを追加
2. Router Lambda（`hello-world/app.ts`）の `TENANT_LAMBDAS` マッピングに追加
3. 再デプロイ

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
