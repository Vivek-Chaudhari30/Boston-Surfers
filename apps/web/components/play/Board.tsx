import type { Entry } from "@cb/shared";
import { ComicBoard } from "./RunResults";

export function Board({
  entries,
  highlightRank,
}: {
  entries: Entry[];
  highlightRank?: number | null;
}) {
  return <ComicBoard entries={entries} highlightRank={highlightRank} />;
}
