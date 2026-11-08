// ChatGPTで作った素材の一覧(ゲームが読む)
// ART: 顔・兵・地形・出来事・女神の力・タイトルの絵(ChatGPTのアートパックから切り出したもの)
// ASSET_FILES: マップ用の画像(tiles.png / cities.png / portraits.png)を assets/ に入れたら名前を書く
globalThis.GD = globalThis.GD || {};
GD.ASSET_FILES = ["tiles.png", "cities.png", "armies.png"];
GD.ART = {
 "portraits": {
  "human_a": "assets/art/portraits/human_a.jpg",
  "elf_a": "assets/art/portraits/elf_a.jpg",
  "dwarf_a": "assets/art/portraits/dwarf_a.jpg",
  "demon_b": "assets/art/portraits/demon_b.jpg",
  "beast_a": "assets/art/portraits/beast_a.jpg",
  "demon_a": "assets/art/portraits/demon_a.jpg",
  "hero": "assets/art/portraits/hero.jpg",
  "queen": "assets/art/portraits/queen.jpg",
  "sage_king": "assets/art/portraits/sage_king.jpg",
  "general": "assets/art/portraits/general.jpg",
  "elf_shrine": "assets/art/portraits/elf_shrine.jpg",
  "mage": "assets/art/portraits/mage.jpg",
  "bard": "assets/art/portraits/bard.jpg",
  "assassin": "assets/art/portraits/assassin.jpg",
  "human_b": "assets/art/portraits/human_b.jpg",
  "elf_b": "assets/art/portraits/elf_b.jpg",
  "dwarf_b": "assets/art/portraits/dwarf_b.jpg",
  "beast_b": "assets/art/portraits/beast_b.jpg",
  "demon_c": "assets/art/portraits/demon_c.jpg",
  "dragon_a": "assets/art/portraits/dragon_a.jpg",
  "dragon_b": "assets/art/portraits/dragon_b.jpg",
  "king": "assets/art/portraits/king.jpg",
  "queen_b": "assets/art/portraits/queen_b.jpg",
  "emperor": "assets/art/portraits/emperor.jpg",
  "pontiff": "assets/art/portraits/pontiff.jpg",
  "farmer": "assets/art/portraits/farmer.jpg",
  "craftsman": "assets/art/portraits/craftsman.jpg",
  "soldier": "assets/art/portraits/soldier.jpg",
  "merchant": "assets/art/portraits/merchant.jpg",
  "priest": "assets/art/portraits/priest.jpg",
  "scholar": "assets/art/portraits/scholar.jpg",
  "demon_d": "assets/art/portraits/demon_d.jpg",
  "demon_e": "assets/art/portraits/demon_e.jpg",
  "demon_f": "assets/art/portraits/demon_f.jpg",
  "dragon_c": "assets/art/portraits/dragon_c.jpg",
  "dragon_d": "assets/art/portraits/dragon_d.jpg",
  "dragon_e": "assets/art/portraits/dragon_e.jpg",
  "dragon_f": "assets/art/portraits/dragon_f.jpg",
  "dragon_g": "assets/art/portraits/dragon_g.jpg",
  "dragon_h": "assets/art/portraits/dragon_h.jpg"
 },
 "units": {
  "inf": "assets/art/units/inf.jpg",
  "rng": "assets/art/units/rng.jpg",
  "cav": "assets/art/units/cav.jpg",
  "mag": "assets/art/units/mag.jpg",
  "mon": "assets/art/units/mon.jpg",
  "dragon": "assets/art/units/dragon.jpg"
 },
 "terrain": {
  "grass": "assets/art/terrain/grass.jpg",
  "forest": "assets/art/terrain/forest.jpg",
  "mountain": "assets/art/terrain/mountain.jpg",
  "snow": "assets/art/terrain/snow.jpg",
  "desert": "assets/art/terrain/desert.jpg",
  "sea": "assets/art/terrain/sea.jpg",
  "lake": "assets/art/terrain/lake.jpg",
  "swamp": "assets/art/terrain/swamp.jpg"
 },
 "events": {
  "fire_city": "assets/art/events/fire_city.jpg",
  "dragon": "assets/art/events/dragon.jpg",
  "lovers": "assets/art/events/lovers.jpg",
  "altar": "assets/art/events/altar.jpg",
  "pillar": "assets/art/events/pillar.jpg",
  "vortex": "assets/art/events/vortex.jpg",
  "meteor": "assets/art/events/meteor.jpg",
  "tornado": "assets/art/events/tornado.jpg",
  "heart": "assets/art/events/heart.jpg",
  "holy": "assets/art/events/holy.jpg",
  "celestial_city": "assets/art/events/celestial_city.jpg",
  "underwater_ruins": "assets/art/events/underwater_ruins.jpg",
  "old_town": "assets/art/events/old_town.jpg",
  "frozen_kingdom": "assets/art/events/frozen_kingdom.jpg",
  "cursed_castle": "assets/art/events/cursed_castle.jpg",
  "volcanic_sky_city": "assets/art/events/volcanic_sky_city.jpg",
  "snowy_forest": "assets/art/events/snowy_forest.jpg",
  "desert_land": "assets/art/events/desert_land.jpg",
  "capital_city": "assets/art/events/capital_city.jpg",
  "burning_fortress": "assets/art/events/burning_fortress.jpg",
  "desert_canyon": "assets/art/events/desert_canyon.jpg"
 },
 "powers": {
  "oracle": "assets/art/powers/oracle.jpg",
  "bless": "assets/art/powers/bless.jpg",
  "harvest": "assets/art/powers/harvest.jpg",
  "disaster": "assets/art/powers/disaster.jpg",
  "hero": "assets/art/powers/hero.jpg",
  "miracle": "assets/art/powers/miracle.jpg"
 },
 "title": "assets/art/title.jpg"
};
// 物語・女神の絵(ChatGPTで新しく作った高画質の絵)
GD.STORY_ART = {
 "goddess_light": "assets/art/story/goddess_light.jpg",
 "goddess_dark": "assets/art/story/goddess_dark.jpg",
 "face_light": "assets/art/story/face_light.jpg",
 "face_dark": "assets/art/story/face_dark.jpg",
 "scene_peace": "assets/art/story/scene_peace.jpg",
 "scene_war": "assets/art/story/scene_war.jpg"
};
