#!/usr/bin/env tsx
/**
 * Generates a tiny synthetic Wikidata dump for testing the streaming parser.
 * Produces `dumps/sample.json` in dump format (one entity per line, wrapped
 * in `[` / `]`), then bz2-compresses it externally via `bzip2`.
 *
 * Five entities chosen to exercise the seed filter:
 *  - Q1048 Julius Caesar          person, classical, ample sitelinks
 *  - Q237  Hannibal Barca         person, classical North African
 *  - Q183491 Mansa Musa           person, medieval West African
 *  - Q43421 Hatshepsut            person, ancient Egyptian
 *  - Q9695   Songhai Empire       organization (historical state), West African
 *  - Q-FAIL  invented stub        only English sitelink → must be REJECTED
 */
import fs from "node:fs";

type Entity = {
  type: "item";
  id: string;
  labels: Record<string, { language: string; value: string }>;
  aliases?: Record<string, Array<{ language: string; value: string }>>;
  claims: Record<string, unknown[]>;
  sitelinks: Record<string, { site: string; title: string }>;
};

function snakItem(prop: string, qid: string) {
  const numeric = parseInt(qid.slice(1), 10);
  return {
    mainsnak: {
      snaktype: "value",
      property: prop,
      datatype: "wikibase-item",
      datavalue: {
        type: "wikibase-entityid",
        value: { "entity-type": "item", "numeric-id": numeric, id: qid },
      },
    },
    rank: "normal",
  };
}

function snakTime(prop: string, time: string, precision = 11) {
  return {
    mainsnak: {
      snaktype: "value",
      property: prop,
      datatype: "time",
      datavalue: {
        type: "time",
        value: {
          time,
          timezone: 0,
          before: 0,
          after: 0,
          precision,
          calendarmodel: "http://www.wikidata.org/entity/Q1985727",
        },
      },
    },
    rank: "normal",
  };
}

function snakCoord(lat: number, lon: number) {
  return {
    mainsnak: {
      snaktype: "value",
      property: "P625",
      datatype: "globe-coordinate",
      datavalue: {
        type: "globecoordinate",
        value: {
          latitude: lat,
          longitude: lon,
          precision: 0.0001,
          globe: "http://www.wikidata.org/entity/Q2",
        },
      },
    },
    rank: "normal",
  };
}

const entities: Entity[] = [
  {
    type: "item",
    id: "Q1048",
    labels: {
      en: { language: "en", value: "Julius Caesar" },
      fr: { language: "fr", value: "Jules César" },
      ar: { language: "ar", value: "يوليوس قيصر" },
      zh: { language: "zh", value: "尤利乌斯·凯撒" },
      ja: { language: "ja", value: "ユリウス・カエサル" },
    },
    aliases: {
      en: [{ language: "en", value: "Caesar" }],
    },
    claims: {
      P31: [snakItem("P31", "Q5")],
      P569: [snakTime("P569", "-0000100-07-12T00:00:00Z", 11)],
      P570: [snakTime("P570", "-0000044-03-15T00:00:00Z", 11)],
      P22: [snakItem("P22", "Q1409")],
      P19: [snakItem("P19", "Q220")],
      P20: [snakItem("P20", "Q220")],
      P27: [snakItem("P27", "Q2277")],
    },
    sitelinks: {
      enwiki: { site: "enwiki", title: "Julius Caesar" },
      frwiki: { site: "frwiki", title: "Jules César" },
      arwiki: { site: "arwiki", title: "يوليوس قيصر" },
      zhwiki: { site: "zhwiki", title: "尤利乌斯·凯撒" },
      jawiki: { site: "jawiki", title: "ユリウス・カエサル" },
    },
  },
  {
    type: "item",
    id: "Q237",
    labels: {
      en: { language: "en", value: "Hannibal" },
      ar: { language: "ar", value: "حنبعل" },
      es: { language: "es", value: "Aníbal" },
      zh: { language: "zh", value: "汉尼拔" },
    },
    claims: {
      P31: [snakItem("P31", "Q5")],
      P569: [snakTime("P569", "-0000247-00-00T00:00:00Z", 9)],
      P570: [snakTime("P570", "-0000181-00-00T00:00:00Z", 9)],
      P27: [snakItem("P27", "Q6343")],
      P19: [snakItem("P19", "Q6343")],
    },
    sitelinks: {
      enwiki: { site: "enwiki", title: "Hannibal" },
      arwiki: { site: "arwiki", title: "حنبعل" },
      eswiki: { site: "eswiki", title: "Aníbal" },
      zhwiki: { site: "zhwiki", title: "汉尼拔" },
    },
  },
  {
    type: "item",
    id: "Q183491",
    labels: {
      en: { language: "en", value: "Mansa Musa" },
      ar: { language: "ar", value: "منسا موسى" },
      yo: { language: "yo", value: "Mansa Musa" },
      ha: { language: "ha", value: "Mansa Musa" },
    },
    claims: {
      P31: [snakItem("P31", "Q5")],
      P569: [snakTime("P569", "+1280-00-00T00:00:00Z", 9)],
      P570: [snakTime("P570", "+1337-00-00T00:00:00Z", 9)],
      P27: [snakItem("P27", "Q623578")],
      P39: [snakItem("P39", "Q1377371")],
    },
    sitelinks: {
      enwiki: { site: "enwiki", title: "Mansa Musa" },
      arwiki: { site: "arwiki", title: "منسا موسى" },
      yowiki: { site: "yowiki", title: "Mansa Musa" },
      hawiki: { site: "hawiki", title: "Mansa Musa" },
    },
  },
  {
    type: "item",
    id: "Q43421",
    labels: {
      en: { language: "en", value: "Hatshepsut" },
      ar: { language: "ar", value: "حتشبسوت" },
      he: { language: "he", value: "חתשפסות" },
      zh: { language: "zh", value: "哈特謝普蘇特" },
    },
    claims: {
      P31: [snakItem("P31", "Q5")],
      P569: [snakTime("P569", "-1507-00-00T00:00:00Z", 9)],
      P570: [snakTime("P570", "-1458-00-00T00:00:00Z", 9)],
      P39: [snakItem("P39", "Q116")],
    },
    sitelinks: {
      enwiki: { site: "enwiki", title: "Hatshepsut" },
      arwiki: { site: "arwiki", title: "حتشبسوت" },
      hewiki: { site: "hewiki", title: "חתשפסות" },
      zhwiki: { site: "zhwiki", title: "哈特謝普蘇特" },
    },
  },
  {
    type: "item",
    id: "Q9695",
    labels: {
      en: { language: "en", value: "Songhai Empire" },
      ar: { language: "ar", value: "إمبراطورية سونغاي" },
      yo: { language: "yo", value: "Ìjọba Songhai" },
    },
    claims: {
      P31: [snakItem("P31", "Q15642541")],
      P571: [snakTime("P571", "+1464-00-00T00:00:00Z", 9)],
      P576: [snakTime("P576", "+1591-00-00T00:00:00Z", 9)],
      P625: [snakCoord(16.27, -0.04)],
    },
    sitelinks: {
      enwiki: { site: "enwiki", title: "Songhai Empire" },
      arwiki: { site: "arwiki", title: "إمبراطورية سونغاي" },
      yowiki: { site: "yowiki", title: "Ìjọba Songhai" },
    },
  },
  // --- This one should be REJECTED: only European wikis, no non-European.
  {
    type: "item",
    id: "Q99999998",
    labels: { en: { language: "en", value: "Filter-fail Test Stub" } },
    claims: {
      P31: [snakItem("P31", "Q5")],
      P569: [snakTime("P569", "+1990-00-00T00:00:00Z", 9)],
    },
    sitelinks: {
      enwiki: { site: "enwiki", title: "Filter-fail Test Stub" },
      frwiki: { site: "frwiki", title: "Filter-fail Test Stub" },
      dewiki: { site: "dewiki", title: "Filter-fail Test Stub" },
    },
  },
  // --- This one should be REJECTED: only 2 sitelinks (under MIN_SITELINKS=3)
  {
    type: "item",
    id: "Q99999999",
    labels: { en: { language: "en", value: "Too-few-sitelinks Stub" } },
    claims: { P31: [snakItem("P31", "Q5")] },
    sitelinks: {
      enwiki: { site: "enwiki", title: "Too-few-sitelinks Stub" },
      arwiki: { site: "arwiki", title: "Too-few-sitelinks Stub" },
    },
  },
];

const lines: string[] = ["["];
entities.forEach((e, i) => {
  const suffix = i === entities.length - 1 ? "" : ",";
  lines.push(JSON.stringify(e) + suffix);
});
lines.push("]");

fs.mkdirSync("./dumps", { recursive: true });
fs.writeFileSync("./dumps/sample.json", lines.join("\n"));
console.log(
  `Wrote dumps/sample.json with ${entities.length} entities (5 should pass, 2 should be rejected).`,
);
console.log("Next: bzip2 dumps/sample.json");
