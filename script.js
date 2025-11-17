import { render, html, signal, effect } from "uhtml";
import traits from "./data/traits.json" with { type: "json" };
import specializations from "./data/specializations.json" with { type: "json" };
import professions from "./data/professions.json" with { type: "json" };

const specsByProfession = new Map();
specializations.forEach((specialization) => {
	const id = specialization.elite ? specialization.id : specialization.profession;
	if (!specsByProfession.has(specialization.profession)) {
	const title = specialization.elite ? specialization.title : professions.find((prof) => prof.id === specialization.profession)?.title;
		specsByProfession.set(id, title);
	}
});

// console.log(specsByProfession);

function getURLParam(name) {
	return new URL(location).searchParams.get(name);
}

class TotemForge extends HTMLElement {
	static schema = {
		anchor: {
			type: "string",
			enum: ["l", "t", "r", "b"],
		},
		name: {
			type: "string",
		},
		effects: {
			type: "array",
		},
	};

	static traits = traits;

	static specializations = specializations;

	#count;
	#anchor;
	#name;
	#effects;

	constructor() {
		super();
		this.#count = signal(getURLParam("count") ?? 0);
		this.#anchor = signal(getURLParam("anchor") ?? "l");
		this.#name = signal(getURLParam("name") ?? "my totem");

		// console.log(TotemForge.traits);
		const MASKS = {
			effect: {
				mask: 0b00000000000000111111111111111111,
				offset: 0
			},
			stacks: {
				mask: 0b00000001111111000000000000000000,
				offset: 18
			},
			target: {
				mask: 0b00011110000000000000000000000000,
				offset: 25
			}
		}

		let id = 32;
		let stacks = 9;
		let target = 3;

		console.group("Initial");
		console.log("id", id, id.toString(2));
		console.log("stacks", stacks, stacks.toString(2));
		console.log("target", target, target.toString(2));
		console.groupEnd();
		
		let offsetTarget = target << MASKS.target.offset;
		let offsetStacks = stacks << MASKS.stacks.offset;
		let combined = offsetTarget + offsetStacks + id;

		console.group("Combined");
		console.log(combined);
		console.log(combined.toString(2));
		console.log(combined.toString(2));
		console.groupEnd();
		
		console.group("Read values");
		console.log("id", combined & MASKS.effect.mask);
		console.log("stacks", (combined & MASKS.stacks.mask) >>> MASKS.stacks.offset);
		console.log("target", (combined & MASKS.target.mask) >>> MASKS.target.offset);
		console.groupEnd();

		const base64Options = {alphabet: "base64url"};

		let arr = new Uint32Array([combined, combined, combined]);
		let arr8 = new Uint8Array(arr.buffer);
		let urlStr = arr8.toBase64(base64Options);
		console.log(urlStr);

		let arrFromUrl = Uint8Array.fromBase64(urlStr, base64Options);
		let arr32FromUrl = new Uint32Array(arrFromUrl.buffer);

		console.log(arr32FromUrl);

		effect(() => {
			// console.log(this.#anchor.value);
			const url = new URL(location);
			url.searchParams.set("count", this.#count.value);
			url.searchParams.set("anchor", this.#anchor.value);
			url.searchParams.set("name", this.#name.value);
			history.replaceState(null, "", url);
		});
	}

	connectedCallback() {
		// eventlistener for drag
		// eventlistener for input change
		render(
			this,
			() =>
				html`<div class="controls">
						<p>Hello ${this.#count.value}.</p>
						<label for="in-name">Pack Name</label>
						<input
							id="in-name"
							.value=${this.#name}
							onchange=${(e) => {
								this.#name.value = e.target.value;
							}}
						/>
						<button onclick=${(e) => this.#count.value++}>
							Clicked ${this.#count.value} times
						</button>
						<label for="in-anchor">Layout Anchor</label>
						<select
							id="in-anchor"
							.value=${this.#anchor.value}
							onchange=${(e) => {
								this.#anchor.value = e.target.value;
							}}
						>
							<option value="l">Left</option>
							<option value="t">Top</option>
							<option value="r">Right</option>
							<option value="b">Bottom</option>
						</select>
					</div>
					<select>
						${specializations.map((specialization) => {
							return html`<option></option>`;
						})}
					</select>
					<div role="listbox">
							<ul role="group" aria-labelledby="group-spec">
								<li id="group-spec" role="presentation">Group Label</li>
								<li id="group-spec" role="option">Trait 1</li>
							</ul>
					</div>
					<ul class="effects">
						<li>Some Effect</li>
						<li>Some Effect</li>
						<li>---------</li>
						<li>Some Effect</li>
						<li>Some Effect</li>
					</ul>
					<textarea class="output"></textarea>`
		);
	}
}

customElements.define("totem-forge", TotemForge);