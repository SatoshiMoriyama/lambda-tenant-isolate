import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { randomUUID } from 'crypto';

// グローバル変数（実行環境ごとに1回だけ初期化される）
const executionEnvironmentId = randomUUID();
let invocationCount = 0;

export const lambdaHandler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
        invocationCount++;

        console.log('Event:', JSON.stringify(event, null, 2));
        console.log('Context:', JSON.stringify(context, null, 2));

        // @ts-ignore - tenantId is not in the standard Context type yet
        const tenantId = context.tenantId;
        console.log('Tenant ID:', tenantId);
        console.log('Execution Environment ID:', executionEnvironmentId);
        console.log('Invocation Count:', invocationCount);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'hello world',
                tenantId: tenantId,
                executionEnvironmentId: executionEnvironmentId,
                invocationCount: invocationCount,
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};
