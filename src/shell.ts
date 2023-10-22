import ctx from './ctx.ts';
import cli from './cli.ts';
import { exec, execSync } from 'child_process';

export default class shell {
	#ctx: ctx;
	constructor() {
		const stdin = process.stdin;
		if (!stdin.isTTY)
			throw new Error();
		const homeCLI = new cli();
		this.#ctx = homeCLI
		this.#ctx.on('stdout', this.onstdout);
		this.#ctx.on('stderr', this.onstdout);
		stdin.setRawMode(true);
		this.#ctx.on("execute", (command) => {
			switch (command) {
				case "clear":
					this.onstdout(`\x1b[H\x1b[0J${homeCLI.prefix} `);
					return;
				case "exit":
					console.log('━'.repeat(process.stdout.columns));
					process.exit(0);
					return;
				default:
					break;
			}
			var pipeLayer = new ctx();
			try {
				console.log('─'.repeat(process.stdout.columns));
				var loggedBefore = false;
				var done = () => {
					if (!loggedBefore)
						process.stdout.write('\x1b[F'); // to erase small line when there is text to seperate
					console.log('━'.repeat(process.stdout.columns));
					process.stdout.write('\x1b[s\n\n\n\x1b[u');
					this.switchToCTX(homeCLI);
					this.onstdout(`\x1b[G\x1b[0J${homeCLI.prefix} `);
				}
				try {
					var proc = Bun.spawn({
						cmd: <string[]>command.match(/"([^"]+)"|\S+|'([^']+)'|`([^`]+)`/g),
						stdin: "pipe",
						stdout: "pipe",
						stderr: "pipe"
					});
				} catch (err: any) {
					if (!loggedBefore) {
						loggedBefore = true;
					}
					this.onstderr(`Invalid Command\n`);
					done();
					return;
				}
				pipeLayer.on("stdin", (data) => {
					switch (data) {
						case "\x03":
							proc.kill(1);
							break;
						default:
							proc.stdin.write(data);
							break;
					}
				});
				var stdoutPipe = new Promise(async () => {
					for await (const chunk of proc.stdout) {
						if (!loggedBefore) {
							loggedBefore = true;
						}
						pipeLayer.emit("stdout", (new TextDecoder().decode(chunk)));
					}
				});
				var stderrPipe = new Promise(async () => {
					for await (const chunk of proc.stderr) {
						if (!loggedBefore) {
							loggedBefore = true;
						}
						pipeLayer.emit("stderr", (new TextDecoder().decode(chunk)));
					}
				});
				this.switchToCTX(pipeLayer);
				proc.exited.then(() => {
					done();
				});
			} catch (err: any) {
				this.onstderr(`${err.name}: ${err.message}`);
			}
		})
		stdin.on('data', (d) => {
			this.#ctx.emit("stdin", d.toString());
		});
		this.onstdout(`\x1b[G\x1b[0J${homeCLI.prefix} `);
	}

	switchToCTX(context: ctx) {
		if (this.#ctx == context)
			return;
		this.#ctx.off('stdout', this.onstdout);
		this.#ctx.off('stderr', this.onstdout);
		this.#ctx = context;
		this.#ctx.on('stdout', this.onstdout);
		this.#ctx.on('stderr', this.onstdout);
	}

	onstdout(data: string) {
		process.stderr.write(data);
	}

	onstderr(data: string) {
		process.stderr.write(`\x1b[91m${data.replace(/\x1B\[0m/g, `\x1b[91m`)}\x1b[0m`);
	}
}