import { Subject, Observable } from 'rxjs';
import { refCount, publishReplay, publish, filter } from 'rxjs/operators';

import { connect, IClientOptions, MqttClient, QoS, IClientPublishOptions } from './mqtt';
import { toFilter } from './topic';

function observableFactory<T>(callback: (source$: Subject<T>) => void) {
    const source$ = new Subject<T>();
    callback(source$);
    return source$;
}

export interface MqttMessage {
    topic: string;
    payload: Uint8Array;
}

export interface SubscribeOptions {
    qos?: QoS;
    retain?: boolean;
}

export class RxMqttClient {
    private client: MqttClient;

    connect$: Observable<void>;
    close$: Observable<void>;
    offline$: Observable<void>;
    error$: Observable<Error>;
    message$: Observable<MqttMessage>;
    subscribe$: Observable<string>;
    unsubscribe$: Observable<string>;

    get options() {
        return this.client.options;
    }

    constructor(url: string, options?: IClientOptions) {
        this.client = connect(url, options);
        this.client.setMaxListeners(Infinity);

        this.connect$ = observableFactory<void>((source$) => {
            this.client.on('connect', () => source$.next());
        });

        this.close$ = observableFactory<void>((source$) => {
            this.client.on('close', () => source$.next());
        });

        this.offline$ = observableFactory<void>((source$) => {
            this.client.on('offline', () => source$.next());
        });

        this.error$ = observableFactory<Error>((source$) => {
            this.client.on('error', (e) => source$.next(e));
        });

        this.message$ = observableFactory<MqttMessage>((source$) => {
            this.client.on('message', (topic, payload) => source$.next({ topic, payload }))
        });

        this.subscribe$ = observableFactory<string>((source$) => {
            this.client.subscribe = new Proxy(this.client.subscribe, {
                apply: (target, thisArg, argumentList) => {
                    source$.next(argumentList[0]);
                    return Reflect.apply(target, thisArg, argumentList);
                }
            });
        });

        this.unsubscribe$ = observableFactory<string>((source$) => {
            this.client.unsubscribe = new Proxy(this.client.unsubscribe, {
                apply: (target, thisArg, argumentList) => {
                    source$.next(argumentList[0]);
                    return Reflect.apply(target, thisArg, argumentList);
                }
            })
        });
    }

    observe(topic: string, options?: SubscribeOptions): Observable<MqttMessage> {
        const topicFilter = toFilter(topic);

        const retain = options && options.retain;
        const clientOptions =
            options && typeof options.qos === 'number'
                ? { qos: options.qos }
                : undefined;

        const source$ = this.message$.pipe(
            filter((message) => topicFilter.test(message.topic))
        );

        return new Observable<MqttMessage>((observer) => {
            const subscription = source$.subscribe(observer);
            this.client.subscribe(topic, clientOptions!);

            return () => {
                subscription.unsubscribe();
                this.client.unsubscribe(topic);
            }
        }).pipe(
            retain ? publishReplay(1) : publish(),
            refCount()
        );
    }

    publish(topic: string, payload: string | Uint8Array, options?: IClientPublishOptions) {
        this.client.publish(topic, payload as any, options!);
    }

    disconnect(): void {
        this.client.end(true);
    }
}