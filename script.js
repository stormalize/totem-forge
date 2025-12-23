import { render, html, svg, signal, computed, effect } from "uhtml";
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

class TotemForge extends HTMLElement {
	static GH_IMG_PREFIX =
		"https://raw.githubusercontent.com/stormalize/totem/v0.1.0/icons/totem/";
	static PACK_METRICS = {
		// start icon
		start: {
			index: 0,
			offsetInline: -38,
			sizeInline: 24,
			sizeBlock: 44,
		},
		pinned: {
			index: 1,
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
			index: 2,
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
		iconDirs: {
			r: "Right",
			d: "Down",
			l: "Left",
			u: "Up",
		},
		packPosition: {
			r: [100, 250],
			d: [400, -200],
			l: [400, 250],
			u: [400, 200],
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
	#directionDir;
	#name;
	#effects;
	#pinnedEffects;
	#unpinnedEffects;
	#selectedActiveEffects;
	#dragoverIndex;
	#dragoverBefore;
	#availableFocusId;
	#selectedFocusId;
	#reffectPackObject;

	#filter;
	#search;
	#pinIndex;

	constructor() {
		super();
		this.#direction = signal(getURLParam("direction") ?? "r");
		this.#directionDir = computed(() => {
			return TotemForge.PACK_METRICS.iconDirs[
				this.#direction.value
			].toLowerCase();
		});
		this.#name = signal(getURLParam("name") ?? "my totem");

		const pinIndex = getURLParam("pin") ?? 0;

		this.#effects = signal(
			this.decodeEffects(getURLParam("effects"), pinIndex) ?? ["PIN"]
		);
		this.#reffectPackObject = computed(() => {
			return this.prepareReffectTemplate(this.#effects.value);
		});
		this.#pinnedEffects = computed(() => {
			const pinIndex = this.#effects.value.findIndex((item) => "PIN" === item);

			return this.#effects.value.filter((item, index) => index < pinIndex);
		});

		this.#unpinnedEffects = computed(() => {
			const pinIndex = this.#effects.value.findIndex((item) => "PIN" === item);

			return this.#effects.value.filter((item, index) => index > pinIndex);
		});

		this.#selectedActiveEffects = signal([]);
		this.#dragoverIndex = signal(null);
		this.#dragoverBefore = signal(null);
		this.#availableFocusId = signal(null);
		this.#selectedFocusId = signal(null);
		this.#filter = signal("");
		this.#search = signal("");

		effect(() => {
			const url = new URL(location);
			url.searchParams.set("direction", this.#direction.value);
			url.searchParams.set("name", this.#name.value);

			const effectsStr = this.encodeEffects(this.#effects.value);
			const pinIndex = this.#effects.value.findIndex((item) => "PIN" === item);

			url.searchParams.set("pin", pinIndex);
			url.searchParams.set("effects", effectsStr);

			history.replaceState(null, "", url);
		});

		this.addEventListener("dragover", (event) => {
			const container = event.target.closest(`.effects-selected`);

			if (container) {
				event.preventDefault();
			}

			const target = event.target.closest(
				`.effects-selected :where(li[totem="effect-item"], li.pin)`
			);

			let index = null;
			let before = null;

			if (target) {
				index = [...target.parentElement.children].indexOf(target);
				before = target.offsetHeight / 2 > event.offsetY;
			}

			if (null !== index) {
				this.#dragoverIndex.value = index;
				this.#dragoverBefore.value = before;
			}
		});

		this.addEventListener("dragend", (event) => {
			const target = event.target.closest(
				`.effects-selected :where(li[totem="effect-item"], li.pin)`
			);

			if (target && null !== this.#dragoverIndex.value) {
				const index = [...target.parentElement.children].indexOf(target);
				const newIndex = this.#dragoverBefore.value
					? this.#dragoverIndex.value
					: this.#dragoverIndex.value + 1;
				this.effectMove(index, newIndex);
			}

			event.target.removeAttribute("draggable");
			this.#dragoverBefore.value = null;
			this.#dragoverIndex.value = null;
		});

		this.addEventListener("mousedown", (event) => {
			if (event.target.matches(`[slot="draghandle"]`)) {
				const effect = event.target.parentNode;
				if (effect && effect.matches(`[totem="effect-item"]`)) {
					effect.setAttribute("draggable", "true");
				}
			}
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

	decodeEffects(str, pinIndex) {
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

			return effects.toSpliced(pinIndex, 0, "PIN");
		}

		return null;
	}

	connectedCallback() {
		render(
			this,
			() =>
				html`<div class="controls">
						<div>
							<label for="in-name">Pack Name</label>
							<input
								id="in-name"
								.value=${this.#name}
								onchange=${(e) => {
									this.#name.value = e.target.value;
								}}
							/>
						</div>
						<div>
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
					</div>
					<h2 id="library-heading" class="library-heading">
						Available Effects
					</h2>
					<div class="library-filter toolbar">
						<div>
							<label for="group-filter">Filter</label>
							<select
								id="group-filter"
								.value=${this.#filter.value}
								onchange=${(e) => {
									this.#filter.value = e.target.value;
								}}
							>
								${effectGroupsFilter.map((item) => {
									return html`<option value=${item.value}>
										${item.label}
									</option>`;
								})}
							</select>
						</div>
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
					<div
						aria-labelledby="library-heading"
						role="listbox"
						class="effects-library"
						tabindex="0"
						aria-activedescendant=${this.#availableFocusId.value
							? this.#availableFocusId.value
							: ""}
						onkeydown=${(event) => {
							this.handleListboxKeys(event);
						}}
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
										class=${`effect-${effect.id}` ===
										this.#availableFocusId.value
											? "focused"
											: ""}
										onclick=${(e) => {
											this.#availableFocusId.value = `effect-${effect.id}`;
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
						Included Effects
					</h2>
					<div class="effect-actions toolbar">
						${this.#selectedActiveEffects.value.length > 0
							? html`<span
									>${this.#selectedActiveEffects.value.length} selected</span
							  >`
							: null}
						<button
							?disabled=${this.#selectedActiveEffects.value.length === 0}
							onclick=${(e) => {
								this.effectsShift();
							}}
						>
							Move Up</button
						><button
							onclick=${(e) => {
								this.effectsShift(true);
							}}
							?disabled=${this.#selectedActiveEffects.value.length === 0}
						>
							Move Down
						</button>
						<button
							onclick=${(e) => {
								this.#selectedActiveEffects.value = [];
							}}
							?disabled=${this.#selectedActiveEffects.value.length === 0}
						>
							Deselect All
						</button>
						<button
							onclick=${(e) => {
								this.deleteSelectedActiveEffects();
							}}
							?disabled=${this.#selectedActiveEffects.value.length === 0}
						>
							Delete
						</button>
					</div>
					<ul
						aria-labelledby="selected-heading"
						role="listbox"
						aria-multiselectable="true"
						class="effects-selected"
						tabindex="0"
						aria-activedescendant=${this.#selectedFocusId.value
							? this.#selectedFocusId.value
							: ""}
						onkeydown=${(event) => {
							this.handleListboxKeys(event, true);
						}}
					>
						${this.#effects.value.map((savedEffect, savedEffectIndex) => {
							const effect = getEffectObject(savedEffect.id);
							return "PIN" === savedEffect
								? html`<li
										id="selected-effect-PIN"
										draggable="true"
										aria-selected=${this.isActiveEffectSelected("PIN")
											? "true"
											: "false"}
										class=${`pin${
											savedEffectIndex === this.#dragoverIndex.value
												? ` drop-${
														this.#dragoverBefore.value ? "before" : "after"
												  }`
												: ""
										}${
											`selected-effect-PIN` === this.#selectedFocusId.value
												? " focused"
												: ""
										}`}
										aria-label="pinned effects end marker"
										onclick=${(e) => {
											this.#selectedFocusId.value = "selected-effect-PIN";
											this.toggleActiveEffectSelected("PIN");
										}}
								  >
										${svg`<svg xmlns="http://www.w3.org/2000/svg" width="78" height="29" viewBox="0 0 78 29">
											<path fill-rule="evenodd" d="M55.3476864,14.1344829 L55.0889888,14.3931805 C53.6602414,15.8219279 51.3412103,15.8193541 49.9092879,14.3874317 L49.3907429,13.8688867 L42.7335912,20.5260384 L43.7706812,21.5631283 C45.4889881,23.2814352 45.4920767,26.0642725 43.7775798,27.7787694 L42.9497475,28.6066017 L36.5857864,22.2426407 L31.6242539,27.180603 L27.3933983,28.6066017 L28.7958267,24.3521759 L33.7573593,19.4142136 L27.3933983,13.0502525 L28.2212306,12.2224202 C29.9357275,10.5079233 32.7185648,10.5110119 34.4368717,12.2293188 L35.4739616,13.2664088 L42.1311133,6.6092571 L41.6125683,6.09071213 C40.1806459,4.65878973 40.1780721,2.33975865 41.6068195,0.911011238 L41.8655171,0.652313635 L55.3476864,14.1344829 Z M62,20 L70,12 L78,20 L62,20 Z M0,20 L8,12 L16,20 L0,20 Z"/>
										</svg>`}
								  </li>`
								: html`<li
										id=${`selected-effect-${savedEffect.id}`}
										totem="effect-item"
										class=${savedEffectIndex === this.#dragoverIndex.value
											? `drop-${
													this.#dragoverBefore.value ? "before" : "after"
											  }`
											: ""}
										controls=""
										class=${`selected-effect-${effect.id}` ===
										this.#selectedFocusId.value
											? "focused"
											: ""}
										aria-selected=${this.isActiveEffectSelected(savedEffect.id)
											? "true"
											: "false"}
										onclick=${(e) => {
											this.#selectedFocusId.value = `selected-effect-${savedEffect.id}`;
											this.toggleActiveEffectSelected(savedEffect.id);
										}}
								  >
										<span slot="draghandle"></span>
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
					<h2 class="output-heading">
						<img
							src="images/logo/totem-forge-icon-color-grad.svg"
							width="39"
							height="44"
						/>Generated Pack
					</h2>
					<textarea readonly="" class="output" rows="16">
${JSON.stringify(this.#reffectPackObject, null, 2)}</textarea
					>
					<div class="output-controls">
						<button
							onclick=${(event) => {
								this.saveFile();
							}}
						>
							Download File
						</button>
						<button
							onclick=${(event) => {
								const success = this.saveToClipboard();
								if (success) {
									event.target.innerText = "Copied!";
									setTimeout(() => {
										event.target.innerText = "Copy to Clipboard";
									}, 1000);
								}
							}}
						>
							Copy to Clipboard
						</button>
					</div>
					<div
						class="output-preview"
						dir=${["u", "l"].includes(this.#direction.value) ? "rtl" : "ltr"}
						style=${`writing-mode: ${
							["r", "l"].includes(this.#direction.value)
								? "horizontal-tb"
								: "vertical-rl"
						}`}
					>
						<img
							src=${`${TotemForge.GH_IMG_PREFIX}/${
								this.#directionDir
							}/totem-start.png`}
						/>
						${this.#pinnedEffects.value?.map(
							(savedEffect, savedEffectIndex) => {
								const effect = getEffectObject(savedEffect.id);

								return html`<div>
									<img
										src=${`${TotemForge.GH_IMG_PREFIX}/${
											this.#directionDir
										}/totem-frame.png`}
									/><img src=${effect.icon} width="32" height="32" />
								</div>`;
							}
						)}
						${this.#unpinnedEffects.value.length === 0
							? html`<img
									src=${`${TotemForge.GH_IMG_PREFIX}/${
										this.#directionDir
									}/totem-end.png`}
							  />`
							: html`<img
									src=${`${TotemForge.GH_IMG_PREFIX}/${
										this.#directionDir
									}/totem-rest.png`}
							  />`}
						<div class="end">
							${this.#unpinnedEffects.value?.map(
								(savedEffect, savedEffectIndex) => {
									const effect = getEffectObject(savedEffect.id);

									return html`
										<img src=${effect.icon} width="32" height="32" />
									`;
								}
							)}
						</div>
					</div>`
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
		} else if ("items" === filter) {
			return filter !== groupProfession;
		} else {
			return ![null, filter].includes(groupProfession);
		}
	}

	handleListboxKeys(event, isSelectedList = false) {
		const items = event.target.querySelectorAll(
			isSelectedList
				? "li"
				: "ul:not([hidden]) > li:not(:where([hidden],[role='presentation']))"
		);
		const focusId = isSelectedList
			? this.#selectedFocusId.value
			: this.#availableFocusId.value;

		const firstItem = items ? items[0] : null;
		const lastItem = items ? items[items.length - 1] : null;
		const currentItem = document.getElementById(focusId);

		let nextItem = null;

		const currentItemIndex = Array.from(items).findIndex(
			(item) => item === currentItem
		);
		const isCurrentItemHidden = -1 === currentItemIndex;

		if (["ArrowUp", "ArrowDown"].includes(event.key)) {
			event.preventDefault();
		}

		if (
			["ArrowUp", "ArrowDown"].includes(event.key) &&
			event.altKey === false &&
			(null === focusId || isCurrentItemHidden) &&
			firstItem
		) {
			// set to first if none are already focused
			nextItem = firstItem;
		} else {
			switch (event.key) {
				case "ArrowDown":
					if (isSelectedList && event.altKey) {
						this.effectsShift(true);
					} else {
						nextItem =
							items.length - 1 > currentItemIndex
								? items[currentItemIndex + 1]
								: firstItem;
					}

					break;

				case "ArrowUp":
					if (isSelectedList && event.altKey) {
						this.effectsShift();
					} else {
						nextItem =
							0 === currentItemIndex ? lastItem : items[currentItemIndex - 1];
					}
					break;

				case "Home":
					nextItem = firstItem;
					break;

				case "Delete":
					this.deleteSelectedActiveEffects();
					break;

				case "End":
					nextItem = lastItem;
					break;

				case " ":
					event.preventDefault();
					if (!isCurrentItemHidden) {
						currentItem.click();
					}
					break;

				default:
					break;
			}
		}
		if (nextItem) {
			if (isSelectedList) {
				this.#selectedFocusId.value = nextItem.id;
			} else {
				this.#availableFocusId.value = nextItem.id;
			}
			nextItem.scrollIntoView({
				block: "nearest",
				inline: "nearest",
			});
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

	effectMove(index, newIndex) {
		const newEffects = structuredClone(this.#effects.value);
		const temp = newEffects[index];
		newEffects.splice(index, 1);
		newEffects.splice(newIndex > index ? newIndex - 1 : newIndex, 0, temp);
		this.#effects.value = newEffects;
	}

	effectsShift(DOWN = false) {
		if (this.#selectedActiveEffects.value.length > 0) {
			const newEffects = structuredClone(this.#effects.value);
			const locations = structuredClone(this.#selectedActiveEffects.value)
				.map((selectedId) => {
					const index = newEffects.findIndex((item) =>
						selectedId === "PIN" ? item === "PIN" : selectedId === item.id
					);
					return [index, selectedId];
				})
				.sort((a, b) => a[0] - b[0]);

			if (DOWN) {
				locations.reverse();
			}

			locations.forEach(([effectIndex, effectId], selectIndex) => {
				if (DOWN) {
					// shift down
					const reverseEffectIndex = Math.abs(
						effectIndex - newEffects.length + 1
					);

					if (reverseEffectIndex > selectIndex && effectIndex !== -1) {
						const temp = newEffects[effectIndex];
						newEffects.splice(effectIndex, 1);
						newEffects.splice(effectIndex + 1, 0, temp);
					}
				} else {
					// shift up
					if (effectIndex > selectIndex && effectIndex !== -1) {
						const temp = newEffects[effectIndex];
						newEffects.splice(effectIndex, 1);
						newEffects.splice(effectIndex - 1, 0, temp);
					}
				}
			});

			this.#effects.value = newEffects;
		}
	}

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

	deleteSelectedActiveEffects() {
		if (this.#selectedActiveEffects.value.length > 0) {
			this.#selectedActiveEffects.value.forEach((effectId) => {
				if ("PIN" !== effectId) {
					this.effectRemove(effectId);
				}
			});
			this.#selectedActiveEffects.value = [];
		}
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

	prepareReffectTemplate(effectList) {
		const pack = structuredClone(reffectTemplates.main);

		const SPECS = TotemForge.PACK_METRICS;

		const packStart = pack.elements[0].members[SPECS.start.index];
		const packPinnedGroup = pack.elements[0].members[SPECS.pinned.index];
		const packEndGroup = pack.elements[0].members[SPECS.end.index];
		const packEndIcon = packEndGroup.members[SPECS.endIcon.index];
		const packRestIcon = packEndGroup.members[SPECS.restIcon.index];
		const packUnpinnedList = packEndGroup.members[SPECS.restList.index];

		const pinnedItemSize = SPECS.pinnedItem.sizeInline;

		const direction = this.#direction.value;
		const directionDir = this.#directionDir.value;
		const packPosition = SPECS.packPosition[direction];

		const INLINE_INDEX = ["r", "l"].includes(direction) ? 0 : 1;
		const BLOCK_INDEX = ["d", "u"].includes(direction) ? 0 : 1;
		// we need to flip offset values for "reversed" directions
		const FLIP_OFFSET = ["l", "u"].includes(direction) ? -1 : 1;

		// apply direction
		pack.pos = packPosition;
		packStart.icon.File = `totem\\${directionDir}\\totem-start.png`;
		packStart.pos[INLINE_INDEX] = SPECS.start.offsetInline * FLIP_OFFSET;
		packStart.pos[BLOCK_INDEX] = 0;
		packStart.size[INLINE_INDEX] = SPECS.start.sizeInline;
		packStart.size[BLOCK_INDEX] = SPECS.start.sizeBlock;

		packEndIcon.icon.File = `totem\\${directionDir}\\totem-end.png`;
		packEndIcon.pos[INLINE_INDEX] = SPECS.endIcon.offsetInline * FLIP_OFFSET;
		packEndIcon.pos[BLOCK_INDEX] = 0;
		packEndIcon.size[INLINE_INDEX] = SPECS.endIcon.sizeInline;
		packEndIcon.size[BLOCK_INDEX] = SPECS.endIcon.sizeBlock;

		packRestIcon.icon.File = `totem\\${directionDir}\\totem-rest.png`;
		packRestIcon.pos[INLINE_INDEX] = SPECS.restIcon.offsetInline * FLIP_OFFSET;
		packRestIcon.pos[BLOCK_INDEX] = 0;
		packRestIcon.size[INLINE_INDEX] = SPECS.restIcon.sizeInline;
		packRestIcon.size[BLOCK_INDEX] = SPECS.restIcon.sizeBlock;

		packUnpinnedList.pos[INLINE_INDEX] =
			SPECS.restList.offsetInline * FLIP_OFFSET;
		packUnpinnedList.pos[BLOCK_INDEX] = 0;
		packUnpinnedList.direction = SPECS.iconDirs[direction];
		// end apply direction

		let pinned = true;
		let pinEndIndex = 0;

		pack.name = this.#name.value;

		effectList.forEach((effect, index) => {
			if ("PIN" === effect) {
				pinned = false;
				pinEndIndex = index;
			} else {
				const effectDetails = getEffectObject(effect.id);
				if (effectDetails) {
					if (pinned) {
						// insert into pinned group
						const part = structuredClone(reffectTemplates.parts.pinnedItem);

						part.name = `${effectDetails.type}: ${effectDetails.name}`;
						part.trigger.source.ids.push(effectDetails.id);

						if (effectDetails.variantIds) {
							part.trigger.source.ids.push(...effectDetails.variantIds);
						}

						if (
							"Intensity" === effectDetails.stacking &&
							effectDetails.maxStacks > 1
						) {
							part.members[
								SPECS.pinnedItemMax.index
							].trigger.threshold.threshold_type.Above =
								effectDetails.maxStacks;
						}

						// apply direction
						part.pos[INLINE_INDEX] = index * pinnedItemSize * FLIP_OFFSET;
						part.pos[BLOCK_INDEX] = 0;

						const maxIcon = part.members[SPECS.pinnedItemMax.index];
						const frameIcon = part.members[SPECS.pinnedItemFrame.index];

						maxIcon.icon.File = `totem\\${directionDir}\\glow-a.png`;
						maxIcon.size[INLINE_INDEX] = SPECS.pinnedItem.sizeInline;
						maxIcon.size[BLOCK_INDEX] = SPECS.pinnedItemMax.sizeBlock;

						frameIcon.icon.File = `totem\\${directionDir}\\totem-frame.png`;
						frameIcon.size[INLINE_INDEX] = SPECS.pinnedItem.sizeInline;
						frameIcon.size[BLOCK_INDEX] = SPECS.pinnedItemFrame.sizeBlock;
						// end apply direction

						packPinnedGroup.members.push(part);
					} else {
						// unpinned "rest" items
						const part = structuredClone(reffectTemplates.parts.unpinnedItem);

						part.name = `${effectDetails.type}: ${effectDetails.name}`;
						part.trigger.source.ids.push(effectDetails.id);

						if (effectDetails.variantIds) {
							part.trigger.source.ids.push(...effectDetails.variantIds);
						}

						packUnpinnedList.icons.push(part);
					}
				}
			}
		});

		// shift end group by number of pinned items, subtracted by a half
		// since pinned items are position center on the first one
		packEndGroup.pos[INLINE_INDEX] =
			(pinEndIndex * pinnedItemSize - pinnedItemSize / 2) * FLIP_OFFSET;
		packEndGroup.pos[BLOCK_INDEX] = 0;

		// toggle list or end, depending on if there are any non-pinned items
		if (effectList.length === pinEndIndex + 1) {
			packRestIcon.enabled = false;
			packEndIcon.enabled = true;
		}

		return pack;
	}

	async saveToClipboard() {
		try {
			const packStr = JSON.stringify(this.#reffectPackObject, null, 2);
			await navigator.clipboard.writeText(packStr);
			return true;
		} catch (error) {
			console.error(error.message);
			return false;
		}
	}

	saveFile() {
		const packStr = JSON.stringify(this.#reffectPackObject, null, 2);
		if (packStr) {
			const blob = new Blob([packStr], { type: "text/plain" });
			const blobURL = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = blobURL;
			a.download = `${this.#name}.json`;
			a.style.display = "none";
			document.body.append(a);
			a.click();

			// cleanup
			setTimeout(() => {
				URL.revokeObjectURL(blobURL);
				a.remove();
			}, 1000);
		}
	}
}

customElements.define("totem-forge", TotemForge);
