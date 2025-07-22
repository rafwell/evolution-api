import { Logger } from '@config/logger.config';
import { BaileysEventMap, MessageUpsertType, proto } from 'baileys';
import { 
  catchError, 
  concatMap, 
  delay, 
  EMPTY, 
  from, 
  retryWhen, 
  Subject, 
  Subscription, 
  take, 
  tap, 
  timeout, 
  mergeMap, 
  of, 
  bufferTime, 
  filter,
  finalize
} from 'rxjs';

type MessageUpsertPayload = BaileysEventMap['messages.upsert'];
type MountProps = {
  onMessageReceive: (payload: MessageUpsertPayload, settings: any) => Promise<void>;
  maxConcurrency?: number;
  timeoutMs?: number;
  batchTimeoutMs?: number;
};

export class BaileysMessageProcessor {
  private processorLogs = new Logger('BaileysMessageProcessor');
  private subscription?: Subscription;

  protected messageSubject = new Subject<{
    messages: proto.IWebMessageInfo[];
    type: MessageUpsertType;
    requestId?: string;
    settings: any;
  }>();

  mount({ 
    onMessageReceive, 
    maxConcurrency = 5, 
    timeoutMs = 30000, 
    batchTimeoutMs = 1000 
  }: MountProps) {
    this.subscription = this.messageSubject
      .pipe(
        // Agrupa mensagens em lotes para melhor performance
        bufferTime(batchTimeoutMs),
        filter(batch => batch.length > 0),
        tap((batch) => {
          this.processorLogs.log(`Processing batch of ${batch.length} message groups`);
        }),
        // Usa mergeMap para processamento paralelo com limite de concorrência
        mergeMap((batch) => 
          from(batch).pipe(
            mergeMap(({ messages, type, requestId, settings }) =>
              from(onMessageReceive({ messages, type, requestId }, settings)).pipe(
                // Timeout para evitar travamentos
                timeout(timeoutMs),
                // Retry com backoff exponencial
                retryWhen((errors) =>
                  errors.pipe(
                    tap((error) => this.processorLogs.warn(`Retrying message batch due to error: ${error.message}`)),
                    delay(1000),
                    take(3),
                    // Se falhar 3 vezes, loga erro mas não trava o stream
                    finalize(() => {
                      this.processorLogs.error(`Failed to process message batch after 3 retries`);
                    })
                  ),
                ),
                // Trata erros individuais sem quebrar o stream
                catchError((error) => {
                  this.processorLogs.error(`Error processing individual message batch: ${error.message}`);
                  return of(null); // Continua o stream
                })
              ),
              maxConcurrency // Limita concorrência
            )
          )
        ),
        // Trata erros no nível do stream
        catchError((error) => {
          this.processorLogs.error(`Critical error in message stream: ${error.message}`);
          return EMPTY;
        }),
      )
      .subscribe({
        next: () => {
          // Log de sucesso opcional
        },
        error: (error) => {
          this.processorLogs.error(`Message stream error: ${error.message}`);
        },
        complete: () => {
          this.processorLogs.log('Message stream completed');
        }
      });
  }

  processMessage(payload: MessageUpsertPayload, settings: any) {
    const { messages, type, requestId } = payload;
    this.messageSubject.next({ messages, type, requestId, settings });
  }

  onDestroy() {
    this.processorLogs.log('Destroying BaileysMessageProcessor');
    this.subscription?.unsubscribe();
    this.messageSubject.complete();
  }
}
