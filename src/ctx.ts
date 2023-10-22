import EventEmitter from "events";

type ctxEvents = "stdin" | "stdout" | "stderr" | "closed" | "execute";

export default class ctx {
	#emitter : EventEmitter = new EventEmitter();
	constructor() {}
	on(event: ctxEvents, fn: (..._: any) => any) { this.#emitter.on(event, fn); }
	once(event: ctxEvents, fn: (..._: any) => any) { this.#emitter.once(event, fn); }
	off(event: ctxEvents, fn: (..._: any) => any) { this.#emitter.off(event, fn); }
	emit(event: ctxEvents, ...data:any) { this.#emitter.emit(event, ...data); }
}