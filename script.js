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

	static MASKS = {
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

	static BASE64OPTIONS = { alphabet: "base64url" };

	static effects = effects;

	#anchor;
	#name;
	#effects;

	#filter;
	#search;

	constructor() {
		super();
		this.#anchor = signal(getURLParam("anchor") ?? "l");
		this.#name = signal(getURLParam("name") ?? "my totem");

		this.#effects = signal(this.decodeEffects(getURLParam("effects") ?? []));

		this.#filter = signal("");
		this.#search = signal("");

		effect(() => {
			const url = new URL(location);
			url.searchParams.set("anchor", this.#anchor.value);
			url.searchParams.set("name", this.#name.value);

			const effectsStr = this.encodeEffects(this.#effects.value);
			url.searchParams.set("effects", effectsStr);

			history.replaceState(null, "", url);
		});

		effect(() => {
			console.log(this.#effects.value);
		});
	}

	encodeEffects(effects) {
		const combined = [];

		effects.forEach((effect) => {
			const id = effect.id;
			const target = effect.target ?? 0;
			const stacks = effect.stacks ?? 0;

			if (Number.isInteger(id) && id) {
				const offsetTarget = target << TotemForge.MASKS.target.offset;
				const offsetStacks = stacks << TotemForge.MASKS.stacks.offset;

				const final = offsetTarget + offsetStacks + id;

				combined.push(final);
			}
		});

		const arr = new Uint32Array(combined);
		const arr8 = new Uint8Array(arr.buffer);
		const str = arr8.toBase64(TotemForge.BASE64OPTIONS);
		console.log(str);
		return str;
	}

	decodeEffects(str) {
		const arrFromUrl = Uint8Array.fromBase64(str, TotemForge.BASE64OPTIONS);
		const arr32FromUrl = new Uint32Array(arrFromUrl.buffer);

		if (arr32FromUrl.length) {
			const effects = [];

			arr32FromUrl.forEach((value) => {
				const id = value & TotemForge.MASKS.effect.mask;
				const stacks = value & TotemForge.MASKS.stacks.mask;
				const target = value & TotemForge.MASKS.target.mask;

				const effect = getEffectObject(id);
				if (effect) {
					effects.push({
						id,
						stacks,
						target,
					});
				}
			});

			return effects;
		}

		return [];
	}

	connectedCallback() {
		// eventlistener for drag
		// eventlistener for input change
		render(
			this,
			() =>
				html`<div class="controls">
						<label for="in-name">Pack Name</label>
						<input
							id="in-name"
							.value=${this.#name}
							onchange=${(e) => {
								this.#name.value = e.target.value;
							}}
						/>
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
					<label for="group-filter">Filter</label>
					<select
						id="group-filter"
						.value=${this.#filter.value}
						onchange=${(e) => (this.#filter.value = e.target.value)}
					>
						${effectGroupsFilter.map((item) => {
							return html`<option value=${item.value}>${item.label}</option>`;
						})}
					</select>
					<label for="search">Search</label>
					<input
						id="search"
						type="search"
						.value=${this.#search.value}
						oninput=${(e) => {
							const newValue = e.target.value;
							this.#search.value = newValue.length >= 2 ? newValue : "";
						}}
					/>
					<div role="listbox" class="effects-list">
						${Array.from(effectGroups.values()).map((group) => {
							return html`<ul
								role="group"
								hidden=${this.isGroupHidden(group.profession)}
								aria-labelledby=${`group-${group.id}-heading`}
							>
								<li id=${`group-${group.id}-heading`} role="presentation">
									${group.label}
								</li>
								${group.effects.map((effect) => {
									return html`<li
										hidden=${!effect.name
											.toLowerCase()
											.includes(this.#search.value)}
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
											>${this.generateSourceContent(effect)}</span
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
								<span slot="source">${this.generateSourceContent(effect)}</span>
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

	isGroupHidden(groupProfession) {
		const filter = this.#filter.value;

		if (!filter) {
			// show all
			return false;
		} else if ("common" === filter) {
			return null !== groupProfession;
		} else {
			return ![null, filter].includes(groupProfession);
		}
	}

	effectRemove(id) {
		this.#effects.value = this.#effects.value.filter(
			(effect) => effect.id !== id
		);
	}

	effectAdd(id) {
		this.#effects.value = [
			...this.#effects.value,
			{ id: id, stacks: 0, target: 0 },
		];
	}

	effectFind(id) {
		return this.#effects.value.find((effect) => effect.id === id);
	}

	effectMove(oldIndex, newIndex) {}
}

customElements.define("totem-forge", TotemForge);
