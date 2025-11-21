import { kMaxLength } from "node:buffer";
import fs from "node:fs";
import { argv } from "node:process";
import { describe } from "node:test";

const DEBUG = argv.includes("--debug");
const REFRESH = argv.includes("--refresh");

const CACHEDIR = "./api-cache";
const TRANSFORMDIR = "./transformed";

const GW2_API = "https://api.guildwars2.com/v2/";

const BUFF_BOONS = [
	"Aegis",
	"Alacrity",
	"Fury",
	"Might",
	"Protection",
	"Quickness",
	"Regeneration",
	"Resistance",
	"Resolution",
	"Stability",
	"Swiftness",
	"Vigor",
];

const BUFF_CONDITIONS = [
	"Bleeding",
	"Burning",
	"Confusion",
	"Poisoned",
	"Torment",
	"Blinded",
	"Chilled",
	"Crippled",
	"Fear",
	"Immobile",
	"Slow",
	"Taunt",
	"Weakness",
	"Vulnerability",
];

const BUFF_COMMON = [
	"Superspeed",
	"Revealed",
	"Stealth",
	"Unblockable",
	"Chaos Aura",
	"Dark Aura",
	"Fire Aura",
	"Frost Aura",
	"Light Aura",
	"Magnetic Aura",
	"Shocking Aura",
];

const effectsList = new Map();

// prefill effects map to manually order
BUFF_BOONS.forEach((effect) => {
	effectsList.set(effect, "");
});

BUFF_CONDITIONS.forEach((effect) => {
	effectsList.set(effect, "");
});

BUFF_COMMON.forEach((effect) => {
	effectsList.set(effect, "");
});

const dataTypes = [
	{
		name: "professions",
		endpoint: "professions?ids=all",
		transform(item) {
			return {
				id: item.id,
				name: item.name,
			};
		},
	},
	{
		name: "specializations",
		endpoint: "specializations?ids=all",
		transform(item) {
			return {
				id: item.id,
				name: item.name,
				profession: item.profession,
				elite: item.elite,
			};
		},
	},
	{
		name: "traits",
		endpoint: "traits?ids=all",
		transform(item) {
			return item;
		},
	},
	{
		name: "skills",
		endpoint: "skills?ids=all",
		transform(item) {
			return {
				id: item.id,
				name: item.name,
				icon: item.icon,
				professions: item.professions,
				slot: item.slot,
			};
		},
	},
];

const saveEffectsFromFacts = (item, dataType) => {
	const maxStacksFact = item.facts?.find(
		(fact) => fact.text === "Maximum Stacks"
	);
	const maxStacks = maxStacksFact?.value;

	if (["traits", "skills"].includes(dataType)) {
		const allFacts = [
			...(Object.hasOwn(item, "facts") ? item.facts : []),
			...(Object.hasOwn(item, "traited_facts") ? item.traited_facts : []),
		];

		allFacts.forEach((fact) => {
			let effect = false;
			const name = fact.status;

			if ("Buff" === fact.type) {
				const type = BUFF_BOONS.includes(name)
					? "Boon"
					: BUFF_CONDITIONS.includes(name)
					? "Condition"
					: BUFF_COMMON.includes(name)
					? "Common"
					: "traits" === dataType
					? "Trait"
					: "skills" === dataType
					? "Skill"
					: "Unknown";

				if (name) {
					effect = {
						id: null,
						name: name,
						icon: fact.icon,
						stacking: maxStacks ? "Intensity" : "Duration",
						maximum: maxStacks ?? null,
						description: fact.description ?? "",
						type: type,
					};

					// only assign sources for non-common effects
					if (["Trait", "Skill"].includes(type)) {
						effect._source = `${dataType}::${item.id}::${item.name}`;
						if ("traits" === dataType) {
							effect.trait = item.id;
							effect.specialization = item.specialization;
						}

						if ("skills" === dataType) {
							effect.skill = item.id;
							effect.slot = item.slot;
							effect.professions = item.professions;
							effect.specialization = item.specialization;
						}

						const existingEffect = effectsList.get(name);

						if (existingEffect) {
							const newEffect = effect;
							effect = existingEffect;

							// only keep different values
							Object.entries(newEffect).forEach(([k, v]) => {
								if (newEffect[k] === effect[k]) {
									delete newEffect[k];
								}
							});

							if (Object.hasOwn(effect, "_variants")) {
								effect._variants = [...effect._variants, newEffect];
							} else {
								effect._variants = [newEffect];
							}
						}
					}
				}
			}

			if (effect) {
				effectsList.set(name, effect);
			}
		});
	}
};

try {
	dataTypes.forEach(async (dataType) => {
		const name = dataType.name;
		const filepath = `${CACHEDIR}/${name}.json`;

		let result = false;
		let resultTransformed = false;

		if (REFRESH || !fs.existsSync(filepath)) {
			const apiResponse = await fetch(`${GW2_API}${dataType.endpoint}`);
			if (!apiResponse.ok) {
				throw new Error(`Response status: ${apiResponse.status}`);
			}

			if (!fs.existsSync(CACHEDIR)) {
				fs.mkdirSync(CACHEDIR);
			}

			result = await apiResponse.json();
			fs.writeFileSync(filepath, JSON.stringify(result), "utf8");
		} else {
			const localData = fs.readFileSync(filepath, "utf8");
			result = JSON.parse(localData);
		}

		if (Array.isArray(result) && Object.hasOwn(dataType, "transform")) {
			resultTransformed = result.map(dataType.transform);
		}

		if (!fs.existsSync(TRANSFORMDIR)) {
			fs.mkdirSync(TRANSFORMDIR);
		}

		const transformPath = `${TRANSFORMDIR}/${dataType.name}.json`;

		fs.writeFileSync(transformPath, JSON.stringify(resultTransformed), "utf8");

		if (["traits", "skills"].includes(dataType.name)) {
			result.forEach((trait) => {
				saveEffectsFromFacts(trait, dataType.name);
			});
		}
	});

	fs.writeFileSync(
		`${TRANSFORMDIR}/effects.json`,
		JSON.stringify(Array.from(effectsList.values())),
		"utf8"
	);
} catch (err) {
	console.error(err);
}
