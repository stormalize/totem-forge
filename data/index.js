import effects from "./effects.json" with { type: "json" };
import specializations from "./specializations.json" with { type: "json" };
import professions from "./professions.json" with { type: "json" };
import main from "./reffect-templates/main.json" with { type: "json" };
import parts from "./reffect-templates/parts.json" with { type: "json" };

// const effects = [];
// const specializations = [];
// const professions = [];

const reffectTemplates = {
	main,
	parts
};

const effectGroups = new Map();

professions.forEach((profession) => {
	const profId = `profession:${profession.id}`;

	effectGroups.set(profId, {
		id: profId,
		label: profession.name,
		effects: [],
		profession: profession.id,
	});

	const profession_core_specs = specializations.filter((spec) => {
		return spec.profession === profession.id && !spec.elite;
	});

	profession_core_specs?.forEach((spec) => {
		const specId = `specialization:${spec.id}`;
		effectGroups.set(`specialization:${spec.id}`, {
			id: specId,
			label: spec.name,
			effects: [],
			profession: profession.id,
		});
	});

	const profession_elite_specs = specializations.filter((spec) => {
		return spec.profession === profession.id && spec.elite;
	});

	profession_elite_specs?.forEach((spec) => {
		const specId = `specialization:${spec.id}`;
		effectGroups.set(`specialization:${spec.id}`, {
			id: specId,
			label: spec.name,
			effects: [],
			profession: profession.id,
		});
	});
});

effectGroups.set(`boon`, {
	id: "boon",
	label: "Boons",
	effects: [],
	profession: null,
});
effectGroups.set(`condition`, {
	id: "condition",
	label: "Conditions",
	effects: [],
	profession: null,
});
effectGroups.set(`common`, {
	id: "common",
	label: "Common",
	effects: [],
	profession: null,
});
effectGroups.set(`items:Sigil`, {
	id: "sigils",
	label: "Sigils",
	effects: [],
	profession: "items",
});
effectGroups.set(`items:Relic`, {
	id: "relics",
	label: "Relics",
	effects: [],
	profession: "items",
});

// sort effects into groups
effects.forEach((effect) => {
	const type = effect.type;

	let groupKey = false;

	switch (type) {
		case "Boon":
			groupKey = "boon";
			break;

		case "Condition":
			groupKey = "condition";
			break;

		case "Common":
			groupKey = "common";
			break;

		case "Item":
			const subtype = effect.subtype;

			if (subtype) {
				groupKey = `items:${subtype}`;

			}
			break;

		case "Trait":
			groupKey = `specialization:${effect.specialization}`;
			break;
		case "Skill":
			if (effect.specialization) {
				groupKey = `specialization:${effect.specialization}`;
			} else if (effect.professions) {
				groupKey = `profession:${effect.professions[0]}`;
			}
			break;
			
		default:
			break;
	}

	const group = effectGroups.get(groupKey);

	if (group) {
		group.effects.push(effect);
	}
});

const effectGroupsFilter = [
	{ value: "", label: "All" },
	...professions.map((profession) => {
		return { value: profession.id, label: profession.name };
	}),
	{ value: "common", label: "Common" },
	{ value: "items", label: "Items" },
];

const getEffectObject = (id) => {
	if (!id) {
		return false;
	}

	const result = effects.find((effect) => effect.id === id);

	return result === undefined ? false : result;
};

export { effects, effectGroups, effectGroupsFilter, getEffectObject, reffectTemplates };
