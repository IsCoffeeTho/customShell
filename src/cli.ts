import { exec, execSync } from "child_process";
import ctx from "./ctx";

export default class cli extends ctx {
	#buffer: string = "";
	#excess: string = "";
	#cachedAutoCompletion: string[] = [];
	#history: string[] = [];

	prefix: string = "❯";
	constructor() {
		super();
		this.on("stdin", (c: string) => {
			switch (c.at(0)) {
				case '\x14': // Ctrl+T
					console.log("\x1b[0J\x1b[1m^T \x1b[91mSIGTERM\x1b[0m");
					process.exit();
				case '\n':
				case '\r':
					var cli_input = this.#buffer + this.#excess;
					if (cli_input.length == 0)
						return;
					this.renderFinalTextView();
					this.#buffer = "";
					this.#excess = "";
					this.emit("execute", cli_input);
					break;
				case '\x1b': // ANSI Terminal standards
					switch (c.at(2)) {
						case 'A': break; // UP
						case 'B': break; // DOWN
						case 'C': // RIGHT
							if (this.#excess.length == 0)
								return;
							this.#buffer += this.#excess[0];
							this.#excess = this.#excess.slice(1);
							this.updateAutoComplete();
							break;
						case 'D':  // LEFT
							if (this.#buffer.length == 0)
								return;
							this.#excess = this.#buffer.at(-1) + this.#excess;
							this.#buffer = this.#buffer.slice(0, -1);
							this.updateAutoComplete();
							break;
					}
					break;
				case '\x7F': // Backspace
					this.#buffer = this.#buffer.slice(0, -1);
					this.updateTextView();
					this.updateAutoComplete();
					break;
				case '\t': // Tabulate
					if (this.#cachedAutoCompletion.length == 0)
						return;
					var completeFrom = this.#buffer.lastIndexOf(' ');
					if (completeFrom < 0)
						completeFrom = 0;
					var completion = <string>this.#cachedAutoCompletion.shift();
					this.#buffer = this.#buffer.slice(0, completeFrom) + completion;
					this.#cachedAutoCompletion.push(completion);
					this.displayAutoComplete();
					break;
				case '\x03':
					break;
				default:
					this.#buffer += c;
					this.updateAutoComplete();
			}
		});
	}

	write(...a: any) { this.emit("stdout", ...a); }

	updateTextView() {
		this.write(`\x1b[G\x1b[0J${this.prefix} ${this.#buffer}\x1b[s${this.#excess}\n\n\n\x1b[u`);
	}

	updateAutoComplete() {
		this.#cachedAutoCompletion = [];
		if (this.#buffer.length == 0)
			return;
		var command = <string[]>this.#buffer.match(/\s*("([^"]+)"{0,1}|\S+|'([^']+)'{0,1}|`([^`]+)`{0,1})/g);
		if (!command)
			return;
		if (command.length == 1) {
			var foundCompletions: string[] = [];
			try {
				foundCompletions = execSync(`compgen -ac "${command[0]}"`).toString().split('\n');
			} catch (err: any) {
				this.#cachedAutoCompletion = [];
				this.updateTextView();
				return;
			}
			this.#cachedAutoCompletion = foundCompletions.filter((v) => {
				return v.length > 0
			});
		}
		this.displayAutoComplete();
	}

	displayAutoComplete() {
		this.updateTextView();
		var command = <string[]>this.#buffer.match(/\s*("([^"]+)"{0,1}|\S+|'([^']+)'{0,1}|`([^`]+)`{0,1})/g);
		if (!command)
			return;
		if (command.length == 1) {
			this.write('\x1b[u\x1b[90m');
			var completion = (<string>this.#cachedAutoCompletion[0]).slice(command[0].length);
			this.write(completion);
			this.write(`\x1b[0m${this.#excess}\n`);
			var col = 0;
			var cols = process.stdout.columns;
			if (this.#cachedAutoCompletion.length == 1) {
				this.write(`\x1b[u`);
				return;
			}
			var showAmount = this.#cachedAutoCompletion.length;
			if (showAmount > 100)
				showAmount = 100;
			for (var i = 0; i < showAmount; i++) {
				var current_comp = this.#cachedAutoCompletion[i];
				var echar = ' ';
				if (col + current_comp.length >= cols) {
					col = 0;
					this.write('\n');
					echar = '';
				}
				this.write(`${current_comp}${echar}`);
			}
			if (showAmount < this.#cachedAutoCompletion.length) {
				this.write(`...`);
			}
		}
		this.write(`\x1b[u`);
	}

	renderFinalTextView() {
		this.write(`\x1b[G\x1b[0J${this.prefix} ${this.#buffer}${this.#excess}\x1b[0J\n`);
	}
}