import { render, html, signal, computed, effect } from "uhtml";
import {
	effects,
	effectGroups,
	effectGroupsFilter,
	getEffectObject,
	reffectTemplates,
} from "data";

function getURLParam(name) {
	return new URL(location).searchParams.get(name);
}

console.log(reffectTemplates);

class TotemForge extends HTMLElement {
	static PACK_METRICS = {
		// start icon
		start: {
			index: 0,
			offsetInline: -38,
			sizeInline: 24,
			sizeBlock: 44,
		},
		// individual pin item group
		pinnedItem: {
			sizeInline: 52,
		},
		pinnedItemMax: {
			index: 0,
			sizeBlock: 104,
		},
		pinnedItemFrame: {
			index: 1,
			sizeBlock: 44,
		},
		// end group
		end: {
			index: -1,
		},
		endIcon: {
			index: 0,
			offsetInline: 6,
			sizeInline: 12,
			sizeBlock: 44,
		},
		restIcon: {
			index: 1,
			offsetInline: 24,
			sizeInline: 48,
			sizeBlock: 44,
		},
		restList: {
			index: 2,
			offsetInline: 32,
		},
		iconDirectories: {
			r: "Right",
			d: "Down",
			l: "Left",
			u: "Up",
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

	#direction;
	#name;
	#effects;
	#selectedActiveEffects;
	#reffectPackObject;

	#filter;
	#search;
	#pinIndex;

	constructor() {
		super();
		this.#direction = signal(getURLParam("direction") ?? "l");
		this.#name = signal(getURLParam("name") ?? "my totem");
		this.#pinIndex = signal(getURLParam("pin") ?? 0);

		this.#effects = signal(
			this.decodeEffects(getURLParam("effects")) ?? ["PIN"]
		);
		this.#reffectPackObject = computed(() => {
			return this.prepareReffectTemplate(this.#effects.value);
		});

		this.#selectedActiveEffects = signal([]);
		this.#filter = signal("");
		this.#search = signal("");

		effect(() => {
			const url = new URL(location);
			url.searchParams.set("direction", this.#direction.value);
			url.searchParams.set("name", this.#name.value);

			const effectsStr = this.encodeEffects(this.#effects.value);
			url.searchParams.set("pin", this.#pinIndex.value);
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
			if (typeof effect === "object") {
				const id = effect.id;
				const target = effect.target ?? 0;
				const stacks = effect.stacks ?? 0;

				if (Number.isInteger(id) && id) {
					const offsetTarget = target << TotemForge.MASKS.target.offset;
					const offsetStacks = stacks << TotemForge.MASKS.stacks.offset;

					const final = offsetTarget + offsetStacks + id;

					combined.push(final);
				}
			}
		});

		const arr = new Uint32Array(combined);
		const arr8 = new Uint8Array(arr.buffer);
		const str = arr8.toBase64(TotemForge.BASE64OPTIONS);

		return str;
	}

	decodeEffects(str) {
		if (!str) {
			return null;
		}

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

			const pin = this.#pinIndex.value;
			return effects.toSpliced(pin, 0, "PIN");
		}

		return null;
	}

	connectedCallback() {
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
						<label for="in-direction">Layout Direction</label>
						<select
							id="in-direction"
							.value=${this.#direction.value}
							onchange=${(e) => {
								this.#direction.value = e.target.value;
							}}
						>
							<option value="r">Right</option>
							<option value="d">Down</option>
							<option value="l">Left</option>
							<option value="u">Up</option>
						</select>
					</div>
					<div class="library-filter">
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
					</div>
					<h2 id="library-heading" class="library-heading">
						Available Effects
					</h2>
					<div
						aria="labelledby"
						="library-heading"
						role="listbox"
						class="effects-library"
					>
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
					<h2 id="selected-heading" class="selected-heading">
						Selected Effects
					</h2>
					<div class="effect-actions">
						<button>Move Up</button><button>Move Down</button
						><button>Delete</button>
					</div>
					<ul
						aria-labelledby="selected-heading"
						role="listbox"
						class="effects-selected"
					>
						${this.#effects.value.map((savedEffect) => {
							const effect = getEffectObject(savedEffect.id);
							return "PIN" === savedEffect
								? html`<li
										aria-selected=${this.isActiveEffectSelected("PIN")
											? "true"
											: "false"}
										class="pin"
										aria-label="pinned effects end marker"
										onclick=${(e) => {
											this.toggleActiveEffectSelected("PIN");
										}}
								  ></li>`
								: html`<li
										totem="effect-item"
										aria-selected=${this.isActiveEffectSelected(savedEffect.id)
											? "true"
											: "false"}
										onclick=${(e) => {
											this.toggleActiveEffectSelected(savedEffect.id);
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
											>${this.generateSourceContent(effect)}</span
										>
								  </li>`;
						})}
					</ul>
					<pre class="output">
${JSON.stringify(this.#reffectPackObject, null, 2)}</pre
					>`
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

	// active effects
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

	// selected active effects
	selectActiveEffect(id) {
		this.#selectedActiveEffects.value = [
			...this.#selectedActiveEffects.value,
			id,
		];
	}

	deselectActiveEffect(id) {
		this.#selectedActiveEffects.value =
			this.#selectedActiveEffects.value.filter((effect) => effect !== id);
	}

	isActiveEffectSelected(id) {
		return this.#selectedActiveEffects.value.find((effect) => effect === id);
	}

	toggleActiveEffectSelected(id) {
		if (this.isActiveEffectSelected(id)) {
			this.deselectActiveEffect(id);
		} else {
			this.selectActiveEffect(id);
		}
	}

	prepareReffectTemplate(effects) {
		const pack = structuredClone(reffectTemplates.main);

		const direction = this.#direction.value;

		const INLINE_INDEX = ["r", "l"].includes(direction) ? 0 : 1;
		const BLOCK_INDEX = ["d", "u"].includes(direction) ? 0 : 1;
		// we need to flip offset values for "reversed" directions
		const FLIP_OFFSET = ["l", "u"].includes(direction) ? -1 : 1;

		let pinned = true;

		console.log(INLINE_INDEX, BLOCK_INDEX);
		// TODO: adjust start and end position based on direction
		pack.name = this.#name.value;

		effects.forEach((effect) => {
			if ("PIN" === effect) {
				pinned = false;
			} else {
				if (pinned) {
					pack;
				} else {
					// unpinned "rest" items
				}
			}
		});

		return pack;
	}
}

customElements.define("totem-forge", TotemForge);
