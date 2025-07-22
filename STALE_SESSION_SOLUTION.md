# Solução para Sessões Stale no WhatsApp

## Problema Identificado

A mensagem "Closing stale open session for new outgoing prekey bundle" indica que o WhatsApp detectou uma sessão criptográfica obsoleta e precisa renová-la. Isso pode causar:

- Travamentos na conexão
- Perda de mensagens
- Reconexões frequentes
- Instabilidade geral do sistema

## Solução Implementada

### 1. Tratamento Robusto de Sessões Stale

**Arquivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts`

#### Método `handleStaleSession`
```typescript
private async handleStaleSession(key: proto.IMessageKey) {
  try {
    this.logger.info('Handling stale session for key:', key.id);
    
    // Tentar reestabelecer a sessão usando requestPlaceholderResend
    await this.client.requestPlaceholderResend(key);
    this.logger.info('Session reestablishment requested successfully');
    
    // Aguardar um pouco para a sessão ser reestabelecida
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar se a conexão ainda está ativa
    if (this.stateConnection.state !== 'open') {
      this.logger.warn('Connection not open after session reestablishment, attempting reconnect...');
      await this.reloadConnection();
    }
    
  } catch (error) {
    this.logger.error('Error handling stale session:', error);
    
    // Se falhar, tentar reconectar completamente
    try {
      this.logger.info('Attempting full reconnection due to stale session...');
      await this.reloadConnection();
    } catch (reconnectError) {
      this.logger.error('Failed to reconnect after stale session:', reconnectError);
    }
  }
}
```

### 2. Configurações Otimizadas

#### Timeouts Ajustados
```typescript
connectTimeoutMs: 90_000,        // Aumentado para 90 segundos
keepAliveIntervalMs: 10_000,     // Reduzido para 10 segundos (mais frequente)
qrTimeout: 60_000,               // Aumentado para 60 segundos
retryRequestDelayMs: 500,        // Aumentado para reduzir pressão na conexão
maxMsgRetryCount: 3,             // Reduzido para evitar loops infinitos
```

#### Configurações Adicionais
```typescript
// Configurações adicionais para melhorar estabilidade
maxCachedMessages: 100,
sessionId: this.instance.name,
heartbeatIntervalMs: 30000,
```

### 3. Detecção e Tratamento Automático

O sistema agora detecta automaticamente quando uma sessão stale é encontrada:

```typescript
if (received?.messageStubParameters?.some?.((param) => 
  param?.includes?.('Closing stale open session for new outgoing prekey bundle')
)) {
  this.logger.warn('Detected stale session error, attempting to handle gracefully...');
  try {
    await this.handleStaleSession(received.key);
  } catch (error) {
    this.logger.error('Failed to handle stale session:', error);
  }
}
```

## Benefícios da Solução

### ✅ **Estabilidade Melhorada**
- Reconexão automática quando necessário
- Tratamento graceful de erros de sessão
- Configurações otimizadas para reduzir problemas

### ✅ **Logs Melhorados**
- Logs detalhados para debugging
- Identificação clara de problemas de sessão
- Rastreamento de tentativas de reconexão

### ✅ **Recuperação Automática**
- Tentativa de reestabelecer sessão antes de reconectar
- Fallback para reconexão completa se necessário
- Verificação de estado da conexão após recuperação

## Monitoramento

Para monitorar se a solução está funcionando, observe os logs:

- `"Detected stale session error, attempting to handle gracefully..."`
- `"Session reestablishment requested successfully"`
- `"Connection not open after session reestablishment, attempting reconnect..."`

## Recomendações Adicionais

1. **Monitoramento**: Configure alertas para quando sessões stale ocorrem frequentemente
2. **Backup**: Mantenha backup das configurações de autenticação
3. **Testes**: Teste a solução em ambiente de desenvolvimento antes de produção
4. **Atualizações**: Mantenha o Baileys atualizado para correções de bugs

## Variáveis de Ambiente Recomendadas

```bash
# Configurações de timeout (opcional)
BAILEYS_CONNECT_TIMEOUT_MS=90000
BAILEYS_KEEP_ALIVE_INTERVAL_MS=10000
BAILEYS_QR_TIMEOUT=60000
BAILEYS_MAX_MSG_RETRY_COUNT=3
BAILEYS_RETRY_REQUEST_DELAY_MS=500
```

Esta solução deve reduzir significativamente os problemas de sessões stale e melhorar a estabilidade geral da conexão com o WhatsApp. 