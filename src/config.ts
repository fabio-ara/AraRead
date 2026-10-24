export const config = {
 name:process.env.APP_NAME || 'AraRead', version:'0.3.0',
 port:Number(process.env.PORT || 4317), origin:process.env.APP_ORIGIN || 'http://127.0.0.1:4317',
 authUrl:process.env.AUTH_URL || 'http://127.0.0.1:4318',
 issuer:process.env.AUTH_ISSUER || 'http://127.0.0.1:4317/auth/v1',
 audience:process.env.AUTH_AUDIENCE || 'authenticated',
 mcpAudience:process.env.MCP_AUDIENCE || 'http://127.0.0.1:4317/mcp',
 database:process.env.DATABASE_URL || 'postgres://araread_app:araread-local-only@127.0.0.1:56432/araread',
 local:process.env.APP_MODE === 'local',
 maxBytes:8*1024*1024,maxAccountBytes:process.env.ARAREAD_RUNTIME==='edge'?16*1024*1024:80*1024*1024,
};
