import { freeWebSearch } from "../src/lib/websearch";

async function main() {
  const hits = await freeWebSearch("NVIDIA debt equity competitors", 8);
  console.log("hits", hits.length);
  for (const h of hits) {
    console.log(
      h.quality.toFixed(2),
      h.kind,
      h.publisher,
      "-",
      h.title.slice(0, 70),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
