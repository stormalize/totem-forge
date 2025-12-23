# Totem Forge

![totem forge logo](/images/logo/totem-forge-logo-color-2.svg)

Tool to build a custom Totem Reffect pack. Make sure you have downloaded the base pack at https://github.com/stormalize/totem in order to install the custom icons correctly.

Then visit the Totem Forge and craft your own totem pack.

## Preview

![screenshot with a diagram denoting pinned and unpinned effects](/_preview/preview-diagram.png)

## Development

**Effects data is up to date for game update: December 16, 2025**

Data on traits, specializations, professions, and effects is stored in `/data`. Since there is no effect endpoint in the GW2 API, I started with a simple script that goes through all skills and traits and looks for `Buff" tooltip facts. From that generated list I did some transforms and then ended up doing a lot of manual editing to add in the effect IDs as well as entire effects that were not listed in a tooltip.

If there are updates needed to the effects, `effect.schema.json` describes the JSON structure I came up with to standardize effect representation.

`api.mjs` could be run again (after a game update for example), but since so much custom editing was done, there would probably need to be another script written to compare against the current effects list; likely it's easier to just make updates manually after balance patches if effects have changed.

### Reffect Pack Template

The main template and template parts are in `/data/reffect-templates` and are based on v1 schema for Reffect packs. If updates need to be made, there is a `PACK_METRICS` static in `TotemForge` that contains all the dimensions for various pack elements which may need to be updated alongside.