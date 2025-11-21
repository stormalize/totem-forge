import { render, html, signal, effect } from "uhtml";
import {
	effects,
	effectGroups,
	effectGroupsFilter,
	getEffectObject,
} from "data";

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

	static effects = effects;

	#count;
	#anchor;
	#name;
	#effects;

	#filter;
	#search;

	constructor() {
		super();
		this.#count = signal(getURLParam("count") ?? 0);
		this.#anchor = signal(getURLParam("anchor") ?? "l");
		this.#name = signal(getURLParam("name") ?? "my totem");
		this.#effects = signal([]);

		this.#filter = signal("");
		this.#search = signal("");

		// console.log(TotemForge.traits);
		const MASKS = {
			effect: {
				mask: 0b00000000000000111111111111111111,
				offset: 0,
			},
			stacks: {
				mask: 0b00000001111111000000000000000000,
				offset: 18,
			},
			target: {
				mask: 0b00011110000000000000000000000000,
				offset: 25,
			},
		};

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
		console.log(
			"stacks",
			(combined & MASKS.stacks.mask) >>> MASKS.stacks.offset
		);
		console.log(
			"target",
			(combined & MASKS.target.mask) >>> MASKS.target.offset
		);
		console.groupEnd();

		const base64Options = { alphabet: "base64url" };

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

		effect(() => {
			console.log(this.#effects.value);
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
					<select
						.value=${this.#filter.value}
						onchange=${(e) => (this.#filter.value = e.target.value)}
					>
						${effectGroupsFilter.map((item) => {
							return html`<option value=${item.value}>${item.label}</option>`;
						})}
					</select>
					<div role="listbox" class="effects-list">
						${Array.from(effectGroups.values()).map((group) => {
							return html`<ul
								role="group"
								aria-labelledby=${`group-${group.id}-heading`}
							>
								<li id=${`group-${group.id}-heading`} role="presentation">
									${group.label}
								</li>
								${group.effects.map((effect) => {
									return html`<li
										totem="effect-item"
										id=${`effect-${effect.id}`}
										role="option"
										aria-selected=${this.effectFind(effect.id)
											? "true"
											: "false"}
										onclick=${(e) => {
											if (this.effectFind(effect.id)) {
												this.effectRemove(effect.id);
											} else {
												this.effectAdd(effect.id);
											}
										}}
									>
										<img
											slot="icon"
											src=${effect.icon}
											width="32"
											height="32"
											alt=""
											loading="lazy"
										/>
										<span slot="name">${effect.name}</span>
										<code
											slot="id"
											title=${effect.variantIds
												? `Main ID: ${
														effect.id
												  }, Others: ${effect.variantIds.join(", ")}`
												: null}
											>ID ${effect.id ?? "?"}</code
										>
										<span slot="source"
											>Source: ${this.generateSourceContent(effect)}</span
										>
									</li>`;
								})}
							</ul>`;
						})}
					</div>
					<hr />
					<ul class="effects">
						${this.#effects.value.map((savedEffect) => {
							const effect = getEffectObject(savedEffect.id);
							return html`<li
								totem="effect-item"
								onclick=${(e) => {
									if (this.effectFind(effect.id)) {
										this.effectRemove(effect.id);
									} else {
										this.effectAdd(effect.id);
									}
								}}
							>
								<img
									slot="icon"
									src=${effect.icon}
									width="32"
									height="32"
									alt=""
									loading="lazy"
								/>
								<span slot="name">${effect.name}</span>
								<code slot="id">ID ${effect.id ?? "?"}</code>
								<span slot="source"
									>Source: ${this.generateSourceContent(effect)}</span
								>
							</li>`;
						})}
						<li>Some Effect</li>
						<li>Some Effect</li>
						<li>---------</li>
						<li>Some Effect</li>
						<li>Some Effect</li>
					</ul>
					<textarea class="output"></textarea>`
		);
	}

	generateSourceContent(effect) {
		const results = new Set();

		let base = effect.type;

		if ("Skill" === effect.type) {
			let slot = effect.slot;
			if (effect.slot.startsWith("Weapon_") && effect.weapon_type) {
				slot = slot.replace("Weapon", effect.weapon_type);
			}
			results.add(`${slot.replace("_", " ")}`);

			if (effect._variants) {
				effect._variants.forEach((variant) => {
					let var_slot = variant.slot ?? slot;
					const weapon_type = variant.weapon_type ?? effect.weapon_type;

					if (var_slot.startsWith("Weapon_") && effect.weapon_type) {
						var_slot = var_slot.replace("Weapon", weapon_type);
					}
					results.add(`${var_slot.replace("_", " ")}`);
				});
			}
		}
		return results.size > 0
			? `${base} (${Array.from(results).join(", ")})`
			: base;
	}

	effectRemove(id) {
		this.#effects.value = this.#effects.value.filter(
			(effect) => effect.id !== id
		);
	}

	effectAdd(id) {
		this.#effects.value = [...this.#effects.value, { id: id, stacks: null }];
	}

	effectFind(id) {
		return this.#effects.value.find((effect) => effect.id === id);
	}

	effectMove(oldIndex, newIndex) {}
}

customElements.define("totem-forge", TotemForge);
