export type EventListener = (arg: any) => void;

export type AvailableListener = {
  [event: string]: EventListener;
};

export class EventEmitter<TAvailableListeners extends AvailableListener> {
  private listeners: Record<string, EventListener[]> = {};

  public on<K extends keyof TAvailableListeners>(
    event: K,
    callback: TAvailableListeners[K]
  ): void {
    const key = event as string;
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback as EventListener);
  }

  protected emit<K extends keyof TAvailableListeners>(
    event: K,
    arg: Parameters<TAvailableListeners[K]>[0]
  ): void {
    const key = event as string;
    if (!this.listeners[key]) {
      return;
    }
    for (const callback of this.listeners[key]) {
      // Shall we prevent people from crashing node by returning a rejected promise
      // and silence errors or shall we assume people can handle their promises?
      // Let's have some hope in humanity and assume the latter.
      callback(arg);
    }
  }
}
