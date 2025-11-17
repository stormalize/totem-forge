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

const BUFF_COMMON = ["Superspeed", "Revealed", "Stealth", "Unblockable"];

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
];

dataTypes.forEach(async (dataType) => {
	try {
		const name = dataType.name;
		const filepath = `${CACHEDIR}/${name}.json`;

		let result = false;

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
			result = result.map(dataType.transform);
		}

		if (!fs.existsSync(TRANSFORMDIR)) {
			fs.mkdirSync(TRANSFORMDIR);
		}

		const transformPath = `${TRANSFORMDIR}/${dataType.name}.json`;

		fs.writeFileSync(transformPath, JSON.stringify(result), "utf8");

		if ("traits" === dataType.name) {
			const effectsFromTraits = new Map();

			// prefill effects map to manually order
			BUFF_BOONS.forEach((effect) => {
				effectsFromTraits.set(effect, "");
			});

			BUFF_CONDITIONS.forEach((effect) => {
				effectsFromTraits.set(effect, "");
			});

			BUFF_COMMON.forEach((effect) => {
				effectsFromTraits.set(effect, "");
			});

			result.forEach((trait) => {
				const maxStacksFact = trait.facts?.find(
					(fact) => fact.text === "Maximum Stacks"
				);
				const maxStacks = maxStacksFact?.value;

				trait.facts?.forEach((fact) => {
					if ("Buff" === fact.type) {
						const status = fact.status;
						const type = BUFF_BOONS.includes(status)
							? "Boon"
							: BUFF_CONDITIONS.includes(status)
							? "Condition"
							: BUFF_COMMON.includes(status)
							? "Common"
							: "Trait";

						if (status) {
							effectsFromTraits.set(status, {
								id: null,
								name: status,
								icon: fact.icon,
								type: type,
								specialization: "Trait" === type ? trait.specialization : null,
								stacking: maxStacks ? "Intensity" : "Duration",
								maximum: maxStacks ?? null,
								description: fact.description ?? "",
							});
						}
					}
				});

				trait.traited_facts?.forEach((fact) => {
					if ("Buff" === fact.type) {
						const status = fact.status;
						const type = BUFF_BOONS.includes(status)
							? "Boon"
							: BUFF_CONDITIONS.includes(status)
							? "Condition"
							: BUFF_COMMON.includes(status)
							? "Common"
							: "Trait";

						if (status) {
							effectsFromTraits.set(status, {
								id: null,
								name: status,
								icon: fact.icon,
								type: type,
								specialization: "Trait" === type ? trait.specialization : null,
								stacking: maxStacks ? "Intensity" : "Duration",
								maximum: maxStacks ?? null,
								description: fact.description ?? "",
							});
						}
					}
				});
			});

			fs.writeFileSync(
				`${TRANSFORMDIR}/trait-effects.json`,
				JSON.stringify(Array.from(effectsFromTraits.values())),
				"utf8"
			);
		}
	} catch (err) {
		console.error(err);
	}
});
