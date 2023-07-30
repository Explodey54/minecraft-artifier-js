const fs = require("node:fs"),
  path = require("node:path");

const minecraftDataPath = path.join(
  __dirname,
  "/external/minecraft-data/data/"
);

const filteredBlocks = [
  "air",
  "end_rod",
  "rail",
  "powered_rail",
  "detector_rail",
  "brewing_stand",
  "activator_rail",
  "unpowered_repeater",
  "unpowered_comparator",
  "powered_repeater",
  "powered_comparator",
  "cake",
  "ladder",
  "vine",
  "tripwire",
  "tripwire_hook",
  "lever",
  "button",
  "redstone_torch",
];

const nonSurvivalBlocks = [
  "air",
  "end_rod",
  "command_block",
  "repeating_command_block",
  "chain_command_block",
  "structure_block",
  "structure_void",
  "barrier",
  "bedrock",
  "end_portal_frame",
  "end_portal",
];

const fallingBlocks = [
  "sand",
  "gravel",
  "anvil",
  "concrete_powder",
  "dragon_egg",
  "red_sand",
];

const redstoneBlocks = [
  "redstone_block",
  "piston",
  "sticky_piston",
  "observer",
  "dispenser",
  "dropper",
  "hopper",
  "redstone_lamp",
  "tnt",
  "sculk_sensor",
  "trapdoor",
  "iron_trapdoor",
];

const dataPaths = JSON.parse(
  fs.readFileSync(path.join(minecraftDataPath, "dataPaths.json"))
).pc;

const versionList = [
  "1.9",
  "1.10",
  "1.11",
  "1.12",
  "1.13",
  "1.14",
  "1.15",
  "1.16",
  "1.17",
  "1.18",
  "1.19",
  "1.20",
];

let currentVersion = 9;
const blockDbs = [];

const figureOutTexture = (name) => {
  const basePath = path.join(__dirname, `./static/textures/`);

  if (
    fs.existsSync(path.join(basePath, `${name.replace(".png", "")}_side.png`))
  ) {
    return `${name.replace(".png", "")}_side.png`;
  } else if (fs.existsSync(path.join(basePath, name))) {
    return `${name}`;
  }

  return "unknown.png";
};

const transformData = (minecraftData, version) => {
  if (minecraftData.variations) {
    return minecraftData.variations.map((variation) => ({
      name: variation.displayName,
      texture_image: `${figureOutTexture(
        `${variation.displayName.toLowerCase().replaceAll(" ", "_")}.png`
      )}`,
      game_id: `minecraft:${minecraftData.name} ${variation.metadata}`,
      game_id_13: `minecraft:${minecraftData.name}`,
      luminance: minecraftData.emitLight > 0,
      transparency: minecraftData.transparent,
      falling: fallingBlocks.includes(minecraftData.name),
      redstone: redstoneBlocks.includes(minecraftData.name),
      survival: !nonSurvivalBlocks.includes(minecraftData.name),
      coral: minecraftData.name.includes("coral"),
      version: version,
    }));
  }

  return {
    name: minecraftData.displayName,
    texture_image: `${figureOutTexture(`${minecraftData.name}.png`)}`,
    game_id: 13 > version ? `minecraft:${minecraftData.name}` : ``,
    game_id_13: version >= 13 ? `minecraft:${minecraftData.name}` : ``,
    luminance: minecraftData.emitLight > 0,
    transparency: minecraftData.transparent,
    falling: fallingBlocks.includes(minecraftData.name),
    redstone: redstoneBlocks.includes(minecraftData.name),
    survival: !nonSurvivalBlocks.includes(minecraftData.name),
    coral: minecraftData.name.includes("coral"),
    version: version,
  };
};

for (const version of versionList) {
  const blocks = JSON.parse(
    fs.readFileSync(
      path.join(minecraftDataPath, dataPaths[version].blocks, "/blocks.json")
    )
  ).sort((a, b) => a.id - b.id);

  const convertedBlock = blocks
    .filter((block) => !filteredBlocks.includes(block.name))
    .map((block) => transformData(block, currentVersion))
    .flat();

  for (const block of convertedBlock) {
    const foundIndex = blockDbs.findIndex((item) => {
      const generalisedName = item.name
        .replace("Wood Planks", "Planks")
        .toLowerCase();
      return item.name === block.name || generalisedName === block.name;
    });

    if (foundIndex !== -1) {
      blockDbs[foundIndex].name = block.name;
      blockDbs[foundIndex].game_id_13 = block.game_id_13;
      blockDbs[foundIndex].texture_image = figureOutTexture(
        `${block.game_id_13.replace("minecraft:", "")}.png`
      );
      continue;
    }

    if (
      blockDbs.find(
        (item) =>
          item.game_id === block.game_id || item.game_id_13 === block.game_id_13
      )
    ) {
      continue;
    }

    blockDbs.push(block);
  }

  currentVersion++;
}

fs.writeFileSync(
  path.join(__dirname, "./static/blocks_20.json"),
  JSON.stringify(blockDbs, null, 2)
);
