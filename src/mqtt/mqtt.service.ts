import {
  Inject,
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import envConfig from 'src/config/environment/env.config';
import {
  IClientOptions,
  IClientPublishOptions,
  MqttClient,
  connect,
} from 'mqtt';
import { randomUUID } from 'crypto';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface TopicMessage {
  topic: string;
  payload: string;
}

@Injectable()
export class MqttService implements OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private readonly messages$ = new Subject<TopicMessage>();
  private readonly watcherCount = new Map<string, number>();
  private readonly activeTopics = new Set<string>();
  private readonly client: MqttClient;

  constructor(
    @Inject(envConfig.KEY)
    private readonly env: ConfigType<typeof envConfig>,
  ) {
    this.client = this.createClient();
    this.setupListeners();
  }

  private createClient(): MqttClient {
    const mqttConfig = this.env.mqtt;

    if (!mqttConfig?.url) {
      throw new Error('Missing MQTT configuration. Please define MQTT_URL.');
    }

    const options: IClientOptions = {
      clientId: mqttConfig.clientId || `robotautomation-api-${randomUUID()}`,
      username: mqttConfig.username || undefined,
      password: mqttConfig.password || undefined,
      keepalive: mqttConfig.keepAlive,
      reconnectPeriod: mqttConfig.reconnectPeriod,
      clean: true,
    };

    return connect(mqttConfig.url, options);
  }

  private setupListeners(): void {
    this.client.on('connect', () => {
      this.logger.log('MQTT broker connection established');
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker');
    });

    this.client.on('close', () => {
      this.logger.warn('MQTT connection closed');
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT client error: ${error.message}`, error.stack);
    });

    this.client.on('message', (topic, payload) => {
      this.messages$.next({
        topic,
        payload: payload.toString(),
      });
    });
  }

  async publish(
    topic: string,
    payload: unknown,
    options?: IClientPublishOptions,
  ): Promise<void> {
    const message = this.stringifyPayload(payload);

    return new Promise<void>((resolve, reject) => {
      this.client.publish(topic, message, options ?? {}, (error) => {
        if (error) {
          this.logger.error(
            `Failed to publish message to topic ${topic}: ${error.message}`,
            error.stack,
          );
          return reject(error);
        }

        this.logger.debug(`Message published to topic ${topic}`);
        resolve();
      });
    });
  }

  streamTopic(topic: string): Observable<MessageEvent> {
    const stream$ = this.messages$.pipe(
      filter((message) => message.topic === topic),
      map((message) => ({
        data: message.payload,
        type: 'mqtt',
      })),
    );

    return new Observable<MessageEvent>((subscriber) => {
      const subscription = stream$.subscribe(subscriber);

      this.addWatcher(topic).catch((error) => subscriber.error(error));

      return () => {
        subscription.unsubscribe();
        this.removeWatcher(topic);
      };
    });
  }

  private async addWatcher(topic: string): Promise<void> {
    const watchers = this.watcherCount.get(topic) ?? 0;
    this.watcherCount.set(topic, watchers + 1);

    if (this.activeTopics.has(topic)) {
      return;
    }

    try {
      await this.subscribeToTopic(topic);
      this.activeTopics.add(topic);
    } catch (error) {
      this.decrementWatcher(topic);
      throw error;
    }
  }

  private removeWatcher(topic: string): void {
    const watchers = this.watcherCount.get(topic);

    if (!watchers) {
      return;
    }

    if (watchers === 1) {
      this.watcherCount.delete(topic);

      if (this.activeTopics.has(topic)) {
        this.activeTopics.delete(topic);
        this.unsubscribeFromTopic(topic);
      }
    } else {
      this.watcherCount.set(topic, watchers - 1);
    }
  }

  private decrementWatcher(topic: string): void {
    const watchers = this.watcherCount.get(topic);

    if (!watchers || watchers === 1) {
      this.watcherCount.delete(topic);
      return;
    }

    this.watcherCount.set(topic, watchers - 1);
  }

  private subscribeToTopic(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, (error) => {
        if (error) {
          this.logger.error(
            `Unable to subscribe to topic ${topic}: ${error.message}`,
            error.stack,
          );
          return reject(error);
        }

        this.logger.log(`Subscribed to topic ${topic}`);
        resolve();
      });
    });
  }

  private unsubscribeFromTopic(topic: string): void {
    this.client.unsubscribe(topic, (error) => {
      if (error) {
        this.logger.error(
          `Unable to unsubscribe from topic ${topic}: ${error.message}`,
          error.stack,
        );
        return;
      }

      this.logger.log(`Unsubscribed from topic ${topic}`);
    });
  }

  private stringifyPayload(payload: unknown): string {
    if (typeof payload === 'string') {
      return payload;
    }

    if (payload instanceof Buffer) {
      return payload.toString();
    }

    return JSON.stringify(payload ?? {});
  }

  onModuleDestroy(): void {
    this.messages$.complete();
    this.client.end(true, () => {
      this.logger.log('MQTT client disconnected');
    });
  }
}
