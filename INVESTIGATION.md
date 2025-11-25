# Lambda テナント分離モード検証レポート

## 概要

AWS Lambda のテナント分離機能（Tenant Isolation Mode）を CloudFormation/SAM で実装し、API Gateway 経由での呼び出しを検証。

## 検証環境

- SAM CLI: v1.148.0
- Lambda Runtime: Node.js 22.x
- Region: ap-northeast-1

## 1. TenancyConfig の対応状況調査

### CloudFormation での対応

- ✅ **対応済み**: `AWS::Lambda::Function` で `TenancyConfig` プロパティをサポート
- ドキュメント: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-lambda-function-tenancyconfig.html

### AWS SAM での対応

- ✅ **対応済み**: SAM CLI v1.147.1 以降で対応
- ドキュメント: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html

### 設定方法

```yaml
Type: AWS::Serverless::Function
Properties:
  TenancyConfig:
    TenantIsolationMode: PER_TENANT
```

**注意**:

- ⚠️ **sam validate でエラーが出る**: SAM CLI v1.148.0 でも `sam validate` 時に "property TenancyConfig not defined" エラーが発生
- ✅ **デプロイは成功する**: `sam validate` でエラーが出ても、`sam deploy` は正常に動作する
- ❌ SAM の簡易 API 定義（`Type: Api`）では統合リクエストマッピングが設定できない
- ✅ CloudFormation で明示的に API Gateway リソースを定義する必要がある

**sam validate のエラー例**:

```
[[E3002: Resource properties are invalid] (Additional properties are not allowed ('TenancyConfig' was unexpected)) matched 14]
Error: Linting failed. At least one linting rule was matched to the provided template.
```

これは SAM CLI の linter が最新の CloudFormation スキーマに追いついていないためと思われる。実際のデプロイには影響しない。

## 2. テナント指定方法

### AWS CLI/SDK からの直接呼び出し

```bash
aws lambda invoke \
  --function-name lambda-tenant-isolate-HelloWorldFunction-MURVicomHdwX \
  --tenant-id test-tenant-001 \
  response.json
```

**結果**: ✅ 成功

```json
{
    "StatusCode": 200,
    "ExecutedVersion": "$LATEST"
}
{"statusCode":200,"body":"{\"message\":\"hello world\"}"}
```

### SAM Local でのテスト

#### テナント ID なしで実行

```bash
sam local invoke
```

**結果**: ❌ 失敗

```
Invoking app.lambdaHandler (nodejs22.x)
Error: The invoked function is enabled with tenancy configuration. Add a valid tenant ID in your request and try again.
```

#### テナント ID ありで実行

```bash
sam local invoke --tenant-id test-tenant-001
```

**結果**: ✅ 成功（SAM CLI v1.147.1 以降）

### API Gateway 経由での呼び出し

#### 試行 1: X-Amz-Tenant-Id を直接指定

```bash
curl -H "X-Amz-Tenant-Id: test-tenant-001" \
  https://7snnhklsf0.execute-api.ap-northeast-1.amazonaws.com/Prod/hello/
```

**結果**: ❌ 失敗

```json
{
  "message": "The invoked function is enabled with tenancy configuration. Add a valid tenant ID in your request and try again."
}
```

**原因**: `X-Amz-*` プレフィックスは AWS 予約ヘッダーで、クライアントから直接指定できない

#### 試行 2: カスタムヘッダー + 統合リクエストマッピング

```yaml
ApiMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    RequestParameters:
      method.request.header.x-tenant-id: false
    Integration:
      RequestParameters:
        integration.request.header.X-Amz-Tenant-Id: method.request.header.x-tenant-id
```

**結果**: ✅ 成功（デプロイ後）

## 3. 制約事項

### Lambda 関数 URL

- ❌ **使用不可**: テナント分離モードと併用できない
- エラー: "Function URL is not supported for functions enabled with tenancy configuration"

### API Gateway の制約

1. SAM の簡易 API 定義では統合リクエストマッピングを設定できない
2. CloudFormation で明示的に API Gateway リソースを定義する必要がある

### 予約ヘッダー

以下のヘッダーは AWS 予約で、クライアントから直接指定不可:

- `x-amz-*`
- `x-amzn-*`

**参考**: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-parameter-mapping.html#http-api-mapping-reserved-headers

## 4. リクエストバリデーション

### RequestParameters の役割

```yaml
RequestParameters:
  method.request.header.x-tenant-id: false # false = オプション
```

- `true`: 必須（ヘッダーがない場合 400 エラー）
- `false`: オプション（ヘッダーがなくても通過）
- **重要**: 統合リクエストでマッピングする場合、定義自体は必須

### RequestValidator の有効化

```yaml
RequestValidator:
  Type: AWS::ApiGateway::RequestValidator
  Properties:
    RestApiId: !Ref ApiGateway
    ValidateRequestParameters: true
    ValidateRequestBody: false

ApiMethod:
  Properties:
    RequestValidatorId: !Ref RequestValidator
```

- `RequestParameters` を定義しただけでは検証されない
- `RequestValidator` を明示的に作成し、メソッドに紐付ける必要がある

## 5. 最終的な実装

### CloudFormation テンプレート構成

```yaml
Resources:
  # Lambda 関数（テナント分離モード有効）
  HelloWorldFunction:
    Type: AWS::Serverless::Function
    Properties:
      TenancyConfig:
        TenantIsolationMode: PER_TENANT

  # API Gateway（明示的定義）
  ApiGateway:
    Type: AWS::ApiGateway::RestApi

  ApiMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RequestParameters:
        method.request.header.x-tenant-id: false
      Integration:
        Type: AWS_PROXY
        RequestParameters:
          integration.request.header.X-Amz-Tenant-Id: method.request.header.x-tenant-id
```

### 呼び出し方法

```bash
# API Gateway 経由（単一リクエスト）
curl -H "x-tenant-id: test-tenant-001" \
  https://<API-ID>.execute-api.ap-northeast-1.amazonaws.com/Prod/hello

# API Gateway 経由（並列リクエスト - テナント分離の検証）
curl -H "x-tenant-id: red" https://9mt84xbqz7.execute-api.ap-northeast-1.amazonaws.com/Prod/hello & \
curl -H "x-tenant-id: blue" https://9mt84xbqz7.execute-api.ap-northeast-1.amazonaws.com/Prod/hello &
wait

# AWS CLI 直接呼び出し
aws lambda invoke \
  --function-name <FUNCTION-NAME> \
  --tenant-id test-tenant-001 \
  response.json
```

## 6. テナント分離機能の考慮点

### 使用すべきケース

1. **エンドユーザーが提供するコードを実行する場合**

   - テナントごとに実行環境を分離することで、不正または悪意のあるコードの影響を制限

2. **テナント固有のデータを処理する場合**
   - 機密情報が他のテナントに漏洩するリスクを防ぐ

### 重要な制約事項

#### 使用不可な機能

- ❌ **Lambda 関数 URL**: 併用不可
- ❌ **Provisioned Concurrency**: 使用不可
- ❌ **SnapStart**: 使用不可

#### 設定の制約

- **不変の設定**: テナント分離は関数作成時のみ設定可能（後から変更不可）
- **tenant-id 必須**: 呼び出し時に必ず tenant-id パラメータが必要
- **実行ロールは共通**: すべてのテナントが同じ実行ロールの権限を使用

### 同時実行数とスケーリング

- **同時実行数の制限**: 通常の Lambda と同じ
- **実行環境の上限**: 1,000 同時実行あたり 2,500 テナント分離実行環境（アクティブまたはアイドル）
- **例**: 関数の同時実行数が 1,000 の場合、最大 2,500 個の異なるテナント実行環境を保持可能

### パフォーマンスへの影響

#### コールドスタートの増加

- **通常の Lambda**: 実行環境が再利用されるためコールドスタートが少ない
- **テナント分離有効**: テナントごとに実行環境が必要なためコールドスタートが増える
- **緩和策**: 同じテナントからの連続リクエストは実行環境を再利用

#### 分離の種類

| 項目             | テナント分離有効                   | テナント分離無効                               |
| ---------------- | ---------------------------------- | ---------------------------------------------- |
| 分離レベル       | テナントレベル                     | 関数レベル                                     |
| 環境の再利用     | 異なるテナント間では再利用されない | 同じ関数の呼び出し間で再利用される可能性       |
| データ分離       | 他テナントのデータにアクセス不可   | 前回の呼び出しのデータにアクセス可能な場合あり |
| コールドスタート | 多い                               | 少ない                                         |

### 料金

- **追加料金**: 新しいテナント分離実行環境を作成する際に課金
- **料金は依存**: メモリサイズと CPU アーキテクチャにより異なる
- **詳細**: https://aws.amazon.com/lambda/pricing

### モニタリング

- **CloudWatch Logs**: テナント ID が自動的にログに含まれる
- **メトリクス**: テナント固有のメトリクスを作成可能
- **X-Ray**: テナント ID を含むトレースが可能

#### CloudWatch Logs Insights でのテナント別フィルタリング

テナント ID でログを絞り込むクエリ:

```
fields @timestamp, @message, tenantId
| filter tenantId = "red"
| sort @timestamp desc
```

複数テナントでフィルター:

```
fields @timestamp, @message, tenantId
| filter tenantId in ["red", "blue", "green"]
| sort @timestamp desc
```

テナント別の集計:

```
fields @timestamp, tenantId
| stats count() by tenantId
| sort count desc
```

### セキュリティ考慮事項

1. **テナント ID の検証**: 関数内でテナント ID が有効かどうかを検証する必要がある
2. **実行ロールの設計**: すべてのテナントが同じ権限を使用するため、最小権限の原則を適用
3. **データ分離**: 実行環境は分離されるが、DynamoDB などの外部リソースへのアクセスはアプリケーション側で制御が必要

### ベストプラクティス

1. **テナント ID のバリデーションを実装**

   ```typescript
   const validTenants = ["tenant-a", "tenant-b", "tenant-c"];
   if (!validTenants.includes(context.tenantId)) {
     throw new Error("Invalid tenant ID");
   }
   ```

2. **テナント固有のメトリクスを記録**

   ```typescript
   await cloudwatch.putMetricData({
     Namespace: "MyApp/Tenants",
     MetricData: [
       {
         MetricName: "Invocations",
         Dimensions: [{ Name: "TenantId", Value: context.tenantId }],
         Value: 1,
       },
     ],
   });
   ```

3. **アクセスパターンの監視**
   - 特定のテナントが過剰にリソースを消費していないか監視
   - 同時実行数の上限に注意

## 7. 実行環境分離の検証

### 並列リクエストによる検証

異なるテナントIDで同時にリクエストを送信し、実行環境が分離されることを確認:

```bash
curl -H "x-tenant-id: red" https://9mt84xbqz7.execute-api.ap-northeast-1.amazonaws.com/Prod/hello & \
curl -H "x-tenant-id: blue" https://9mt84xbqz7.execute-api.ap-northeast-1.amazonaws.com/Prod/hello &
wait
```

**確認ポイント**:
- レスポンスの `executionEnvironmentId` が異なることを確認
- CloudWatch Logs で `tenantId` フィールドが正しく記録されていることを確認
- 各テナントの `invocationCount` が独立してカウントされることを確認

## 8. まとめ

### 成功したこと

- ✅ CloudFormation/SAM でテナント分離モードを設定
- ✅ AWS CLI から直接呼び出し
- ✅ API Gateway 経由でカスタムヘッダーをマッピング
- ✅ 並列リクエストでテナント間の実行環境分離を確認

### 学んだこと

1. SAM の簡易 API 定義では統合リクエストマッピングが設定できない
2. `X-Amz-*` プレフィックスは AWS 予約ヘッダー
3. `RequestParameters` の定義と `RequestValidator` の有効化は別物
4. Lambda 関数 URL はテナント分離モードと併用不可

### 推奨事項

- API Gateway 経由でテナント分離を使う場合は、CloudFormation で明示的にリソースを定義
- 開発/テスト時は AWS CLI からの直接呼び出しが簡単
- 本番環境では API Gateway + 統合リクエストマッピングを使用

## 参考ドキュメント

- [Lambda テナント分離の設定](https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation-configure.html)
- [Lambda テナント分離での呼び出し](https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation-invoke.html)
- [API Gateway 予約ヘッダー](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-parameter-mapping.html#http-api-mapping-reserved-headers)
- [CloudFormation TenancyConfig](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-lambda-function-tenancyconfig.html)
